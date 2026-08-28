import { ApiError } from './authApi.js'

function createBasePath(memoryId) {
  return `/api/memories/${encodeURIComponent(memoryId)}/family-questions`
}

async function request(
  accessToken,
  memoryId,
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

  if (body !== undefined) {
    options.headers['Content-Type'] =
      'application/json'

    options.body = JSON.stringify(body)
  }

  let response

  try {
    response = await fetch(
      createBasePath(memoryId),
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

  const payload = await response
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

export async function listFamilyQuestions(
  accessToken,
  memoryId,
) {
  const data = await request(
    accessToken,
    memoryId,
  )

  return data.familyQuestions
}

export async function createFamilyQuestion(
  accessToken,
  memoryId,
  input,
) {
  const data = await request(
    accessToken,
    memoryId,
    {
      method: 'POST',
      body: input,
    },
  )

  return data.familyQuestion
}
