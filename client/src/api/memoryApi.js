import { ApiError } from './authApi.js'
import {
  approveAccessibleMemoryStory,
  archiveAccessibleMemoryStory,
  createAccessibleMemoryStory,
  getAccessibleMemoryProfile,
  listAccessibleMemoryStories,
  listSharedMemoryProfiles,
  updateAccessibleMemoryStory,
} from './familyAccessApi.js'

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
  const [data, sharedProfiles] =
    await Promise.all([
      request('', accessToken),
      listSharedMemoryProfiles(
        accessToken,
      ),
    ])

  return [
    ...data.memoryProfiles.map(
      (memoryProfile) => ({
        ...memoryProfile,
        authorization: {
          accessType: 'owner',
          role: 'owner',
        },
      }),
    ),
    ...sharedProfiles,
  ].sort((first, second) =>
    new Date(second.createdAt).getTime() -
    new Date(first.createdAt).getTime(),
  )
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
  return getAccessibleMemoryProfile(
    accessToken,
    memoryId,
  )
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
  return listAccessibleMemoryStories(
    accessToken,
    memoryId,
  )
}

export async function getMemoryTimeline(
  accessToken,
  memoryId,
) {
  const data = await request(
    `/${encodeURIComponent(memoryId)}/timeline`,
    accessToken,
  )

  return data.timeline
}

export async function searchMemoryArchive(
  accessToken,
  memoryId,
  {
    query = '',
    sourceType = 'all',
    audioFilter = 'all',
    limit = 30,
  } = {},
) {
  const searchParams =
    new URLSearchParams({
      q: query,
      sourceType,
      audioFilter,
      limit: String(limit),
    })

  const data = await request(
    `/${encodeURIComponent(memoryId)}/archive-search?${searchParams.toString()}`,
    accessToken,
  )

  return data.search
}

export async function createMemoryStory(
  accessToken,
  memoryId,
  input,
) {
  return createAccessibleMemoryStory(
    accessToken,
    memoryId,
    input,
  )
}

export async function approveMemoryStory(
  accessToken,
  memoryId,
  storyId,
) {
  return approveAccessibleMemoryStory(
    accessToken,
    memoryId,
    storyId,
  )
}

export async function updateMemoryStory(
  accessToken,
  memoryId,
  storyId,
  input,
) {
  return updateAccessibleMemoryStory(
    accessToken,
    memoryId,
    storyId,
    input,
  )
}

export async function archiveMemoryStory(
  accessToken,
  memoryId,
  storyId,
) {
  await archiveAccessibleMemoryStory(
    accessToken,
    memoryId,
    storyId,
  )
}

export async function getDigitalPersonaSetup(
  accessToken,
  memoryId,
) {
  const data = await request(
    `/${encodeURIComponent(memoryId)}/digital-persona`,
    accessToken,
  )

  return data.digitalPersona
}

export async function acceptDigitalPersonaSelfConsent(
  accessToken,
  memoryId,
  input,
) {
  const data = await request(
    `/${encodeURIComponent(memoryId)}/digital-persona/consent`,
    accessToken,
    {
      method: 'PUT',
      body: input,
    },
  )

  return data.digitalPersona
}

export async function revokeDigitalPersonaSelfConsent(
  accessToken,
  memoryId,
) {
  const data = await request(
    `/${encodeURIComponent(memoryId)}/digital-persona/consent`,
    accessToken,
    {
      method: 'DELETE',
    },
  )

  return data.digitalPersona
}

export async function initializeDigitalPersonaMockProfiles(
  accessToken,
  memoryId,
) {
  const data = await request(
    `/${encodeURIComponent(memoryId)}/digital-persona/mock-profiles`,
    accessToken,
    {
      method: 'POST',
    },
  )

  return data.digitalPersona
}

export async function activateDigitalPersonaVoiceClone(
  accessToken,
  memoryId,
  input,
) {
  const data = await request(
    `/${encodeURIComponent(memoryId)}/digital-persona/voice-clone`,
    accessToken,
    {
      method: 'PUT',
      body: input,
    },
  )

  return data.digitalPersona
}

export async function activateDigitalPersonaChatVoiceInput(
  accessToken,
  memoryId,
  input,
) {
  const data = await request(
    `/${encodeURIComponent(memoryId)}/digital-persona/chat-voice-input`,
    accessToken,
    {
      method: 'PUT',
      body: input,
    },
  )

  return data.digitalPersona
}

export async function activateDigitalPersonaDIDAvatar(
  accessToken,
  memoryId,
  input,
) {
  const data = await request(
    `/${encodeURIComponent(memoryId)}/digital-persona/avatar`,
    accessToken,
    {
      method: 'PUT',
      body: input,
    },
  )

  return data.digitalPersona
}
