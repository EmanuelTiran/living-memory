import { ApiError } from './authApi.js'

function createChatBasePath(memoryId) {
  return `/api/memories/${encodeURIComponent(memoryId)}/chat`
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
      `${createChatBasePath(memoryId)}${path}`,
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

export async function createMemoryChatConversation(
  accessToken,
  memoryId,
) {
  const data = await request(
    memoryId,
    '/conversations',
    accessToken,
    {
      method: 'POST',
    },
  )

  return data.conversation
}

export async function sendMemoryChatMessage(
  accessToken,
  memoryId,
  conversationId,
  message,
  {
    responseMode,
  } = {},
) {
  const body = {
    message,
  }

  if (responseMode) {
    body.responseMode = responseMode
  }

  return request(
    memoryId,
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    accessToken,
    {
      method: 'POST',
      body,
    },
  )
}

export async function getMemoryChatHistory(
  accessToken,
  memoryId,
  conversationId,
  {
    limit = 50,
    beforeMessageId,
  } = {},
) {
  const query = new URLSearchParams({
    limit: String(limit),
  })

  if (beforeMessageId) {
    query.set(
      'beforeMessageId',
      beforeMessageId,
    )
  }

  return request(
    memoryId,
    `/conversations/${encodeURIComponent(conversationId)}/messages?${query.toString()}`,
    accessToken,
  )
}