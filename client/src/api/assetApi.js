import { ApiError } from './authApi.js'

function createAssetBasePath(memoryId) {
  return `/api/memories/${encodeURIComponent(memoryId)}/assets`
}

async function request(
  memoryId,
  path,
  accessToken,
  {
    method = 'GET',
    body,
  } = {},
) {
  const options = {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      Authorization:
        `Bearer ${accessToken}`,
    },
  }

  if (body instanceof FormData) {
    options.body = body
  } else if (body !== undefined) {
    options.headers['Content-Type'] =
      'application/json'
    options.body = JSON.stringify(body)
  }

  let response

  try {
    response = await fetch(
      `${createAssetBasePath(memoryId)}${path}`,
      options,
    )
  } catch {
    throw new ApiError(
      'Unable to connect to the server.',
      {
        code: 'NETWORK_ERROR',
      },
    )
  }

  const payload =
    response.status === 204
      ? null
      : await response
        .json()
        .catch(() => null)

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message ??
        'The request could not be completed.',
      {
        statusCode: response.status,
        code:
          payload?.error?.code ??
          'REQUEST_FAILED',
        details:
          payload?.error?.details ?? [],
      },
    )
  }

  return payload?.data ?? null
}

async function requestFile(
  memoryId,
  assetId,
  accessToken,
  action,
) {
  let response

  try {
    response = await fetch(
      `${createAssetBasePath(memoryId)}/${encodeURIComponent(assetId)}/${action}`,
      {
        credentials: 'include',
        headers: {
          Accept:
            'image/jpeg,image/png,image/webp,application/pdf',
          Authorization:
            `Bearer ${accessToken}`,
        },
      },
    )
  } catch {
    throw new ApiError(
      'Unable to connect to the server.',
      {
        code: 'NETWORK_ERROR',
      },
    )
  }

  if (!response.ok) {
    const payload = await response
      .json()
      .catch(() => null)

    throw new ApiError(
      payload?.error?.message ??
        'The file could not be loaded.',
      {
        statusCode: response.status,
        code:
          payload?.error?.code ??
          'REQUEST_FAILED',
      },
    )
  }

  const blob = await response.blob()

  if (blob.size === 0) {
    throw new ApiError(
      'The file response was empty.',
      {
        code:
          'MEMORY_ASSET_FILE_EMPTY',
      },
    )
  }

  return blob
}

export async function listMemoryAssets(
  accessToken,
  memoryId,
) {
  const data = await request(
    memoryId,
    '',
    accessToken,
  )

  return data.assets
}

export async function uploadMemoryAsset(
  accessToken,
  memoryId,
  {
    file,
    displayName,
    description,
  },
) {
  const formData = new FormData()

  formData.append('displayName', displayName)
  formData.append('description', description)
  formData.append('asset', file, file.name)

  const data = await request(
    memoryId,
    '',
    accessToken,
    {
      method: 'POST',
      body: formData,
    },
  )

  return data.asset
}

export async function createMemoryAssetAccessLink(
  accessToken,
  memoryId,
  assetId,
  disposition,
) {
  const data = await request(
    memoryId,
    `/${encodeURIComponent(assetId)}/access-link`,
    accessToken,
    {
      method: 'POST',
      body: {
        disposition,
      },
    },
  )

  return data.access
}

export async function updateMemoryAssetMetadata(
  accessToken,
  memoryId,
  assetId,
  input,
) {
  const data = await request(
    memoryId,
    `/${encodeURIComponent(assetId)}`,
    accessToken,
    {
      method: 'PATCH',
      body: input,
    },
  )

  return data.asset
}

export function viewMemoryAssetFile(
  accessToken,
  memoryId,
  assetId,
) {
  return requestFile(
    memoryId,
    assetId,
    accessToken,
    'file',
  )
}

export function downloadMemoryAssetFile(
  accessToken,
  memoryId,
  assetId,
) {
  return requestFile(
    memoryId,
    assetId,
    accessToken,
    'download',
  )
}

export async function archiveMemoryAsset(
  accessToken,
  memoryId,
  assetId,
) {
  const data = await request(
    memoryId,
    `/${encodeURIComponent(assetId)}`,
    accessToken,
    {
      method: 'DELETE',
    },
  )

  return data.asset
}
