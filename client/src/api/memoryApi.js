import { ApiError } from './authApi.js'

async function request(
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
      Authorization: `Bearer ${accessToken}`,
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
      `/api/memories${path}`,
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

export async function listMemoryProfiles(
  accessToken,
) {
  const data = await request(
    '',
    accessToken,
  )

  return data.memoryProfiles
}

export async function createMemoryProfile(
  accessToken,
  input,
) {
  const data = await request(
    '',
    accessToken,
    {
      method: 'POST',
      body: input,
    },
  )

  return data.memoryProfile
}

export async function getMemoryProfile(
  accessToken,
  memoryId,
) {
  const data = await request(
    `/${encodeURIComponent(memoryId)}`,
    accessToken,
  )

  return data.memoryProfile
}

export async function updateMemoryProfile(
  accessToken,
  memoryId,
  input,
) {
  const data = await request(
    `/${encodeURIComponent(memoryId)}`,
    accessToken,
    {
      method: 'PATCH',
      body: input,
    },
  )

  return data.memoryProfile
}

export async function archiveMemoryProfile(
  accessToken,
  memoryId,
) {
  await request(
    `/${encodeURIComponent(memoryId)}`,
    accessToken,
    {
      method: 'DELETE',
    },
  )
}

export async function listMemoryStories(
  accessToken,
  memoryId,
) {
  const data = await request(
    `/${encodeURIComponent(memoryId)}/stories`,
    accessToken,
  )

  return data.memoryStories
}

export async function createMemoryStory(
  accessToken,
  memoryId,
  input,
) {
  const data = await request(
    `/${encodeURIComponent(memoryId)}/stories`,
    accessToken,
    {
      method: 'POST',
      body: input,
    },
  )

  return data.memoryStory
}

export async function approveMemoryStory(
  accessToken,
  memoryId,
  storyId,
) {
  const data = await request(
    `/${encodeURIComponent(memoryId)}/stories/${encodeURIComponent(storyId)}/approve`,
    accessToken,
    {
      method: 'PATCH',
    },
  )

  return data.memoryStory
}

export async function updateMemoryStory(
  accessToken,
  memoryId,
  storyId,
  input,
) {
  const data = await request(
    `/${encodeURIComponent(memoryId)}/stories/${encodeURIComponent(storyId)}`,
    accessToken,
    {
      method: 'PATCH',
      body: input,
    },
  )

  return data.memoryStory
}

export async function archiveMemoryStory(
  accessToken,
  memoryId,
  storyId,
) {
  await request(
    `/${encodeURIComponent(memoryId)}/stories/${encodeURIComponent(storyId)}`,
    accessToken,
    {
      method: 'DELETE',
    },
  )
}