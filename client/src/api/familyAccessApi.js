import { ApiError } from './authApi.js'

async function request(
  path,
  {
    accessToken,
    method = 'GET',
    body,
  } = {},
) {
  const headers = {
    Accept: 'application/json',
  }

  if (accessToken) {
    headers.Authorization =
      `Bearer ${accessToken}`
  }

  const options = {
    method,
    credentials: 'include',
    headers,
  }

  if (body !== undefined) {
    headers['Content-Type'] =
      'application/json'

    options.body = JSON.stringify(body)
  }

  let response

  try {
    response = await fetch(
      `/api/family-access${path}`,
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

export async function listSharedMemoryProfiles(
  accessToken,
) {
  const data = await request('/memories', {
    accessToken,
  })

  return data.memoryProfiles
}

export async function getAccessibleMemoryProfile(
  accessToken,
  memoryId,
) {
  const data = await request(
    `/memories/${encodeURIComponent(memoryId)}`,
    {
      accessToken,
    },
  )

  return data.memoryProfile
}

export async function getMemoryFamilyAccess(
  accessToken,
  memoryId,
) {
  const data = await request(
    `/memories/${encodeURIComponent(memoryId)}/access`,
    {
      accessToken,
    },
  )

  return data.familyAccess
}

export async function createMemoryInvitation(
  accessToken,
  memoryId,
  input,
) {
  return request(
    `/memories/${encodeURIComponent(memoryId)}/invitations`,
    {
      accessToken,
      method: 'POST',
      body: input,
    },
  )
}

export async function revokeMemoryInvitation(
  accessToken,
  memoryId,
  invitationId,
) {
  const data = await request(
    `/memories/${encodeURIComponent(memoryId)}/invitations/${encodeURIComponent(invitationId)}`,
    {
      accessToken,
      method: 'DELETE',
    },
  )

  return data.invitation
}

export async function updateMemoryMemberRole(
  accessToken,
  memoryId,
  membershipId,
  role,
) {
  const data = await request(
    `/memories/${encodeURIComponent(memoryId)}/members/${encodeURIComponent(membershipId)}`,
    {
      accessToken,
      method: 'PATCH',
      body: {
        role,
      },
    },
  )

  return data.member
}

export async function revokeMemoryMember(
  accessToken,
  memoryId,
  membershipId,
) {
  const data = await request(
    `/memories/${encodeURIComponent(memoryId)}/members/${encodeURIComponent(membershipId)}`,
    {
      accessToken,
      method: 'DELETE',
    },
  )

  return data.member
}

export async function previewMemoryInvitation(
  token,
) {
  const data = await request(
    '/invitations/preview',
    {
      method: 'POST',
      body: {
        token,
      },
    },
  )

  return data.invitation
}

export async function acceptMemoryInvitation(
  accessToken,
  input,
) {
  return request('/invitations/accept', {
    accessToken,
    method: 'POST',
    body: input,
  })
}

export async function listAccessibleMemoryStories(
  accessToken,
  memoryId,
) {
  const data = await request(
    `/memories/${encodeURIComponent(memoryId)}/stories`,
    {
      accessToken,
    },
  )

  return data.memoryStories
}

export async function createAccessibleMemoryStory(
  accessToken,
  memoryId,
  input,
) {
  const data = await request(
    `/memories/${encodeURIComponent(memoryId)}/stories`,
    {
      accessToken,
      method: 'POST',
      body: input,
    },
  )

  return data.memoryStory
}

export async function approveAccessibleMemoryStory(
  accessToken,
  memoryId,
  storyId,
) {
  const data = await request(
    `/memories/${encodeURIComponent(memoryId)}/stories/${encodeURIComponent(storyId)}/approve`,
    {
      accessToken,
      method: 'PATCH',
    },
  )

  return data.memoryStory
}

export async function updateAccessibleMemoryStory(
  accessToken,
  memoryId,
  storyId,
  input,
) {
  const data = await request(
    `/memories/${encodeURIComponent(memoryId)}/stories/${encodeURIComponent(storyId)}`,
    {
      accessToken,
      method: 'PATCH',
      body: input,
    },
  )

  return data.memoryStory
}

export async function archiveAccessibleMemoryStory(
  accessToken,
  memoryId,
  storyId,
) {
  await request(
    `/memories/${encodeURIComponent(memoryId)}/stories/${encodeURIComponent(storyId)}`,
    {
      accessToken,
      method: 'DELETE',
    },
  )
}

export async function getMemoryPilot(
  accessToken,
  memoryId,
) {
  return request(
    `/memories/${encodeURIComponent(memoryId)}/pilot`,
    {
      accessToken,
    },
  )
}

export async function startMemoryPilot(
  accessToken,
  memoryId,
) {
  return request(
    `/memories/${encodeURIComponent(memoryId)}/pilot`,
    {
      accessToken,
      method: 'POST',
    },
  )
}

export async function withdrawMemoryPilot(
  accessToken,
  memoryId,
) {
  return request(
    `/memories/${encodeURIComponent(memoryId)}/pilot/withdraw`,
    {
      accessToken,
      method: 'PATCH',
    },
  )
}
