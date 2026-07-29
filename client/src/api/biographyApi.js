import { ApiError } from './authApi.js'

function createBiographyBasePath(memoryId) {
  return `/api/memories/${encodeURIComponent(memoryId)}/biography`
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

  if (body !== undefined) {
    options.headers['Content-Type'] =
      'application/json'

    options.body = JSON.stringify(body)
  }

  let response

  try {
    response = await fetch(
      `${createBiographyBasePath(memoryId)}${path}`,
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

export async function getBiographyQuestionnaire(
  accessToken,
  memoryId,
) {
  const data = await request(
    memoryId,
    '/questionnaire',
    accessToken,
  )

  return data.questionnaire
}

export async function saveBiographyQuestionnaireAnswer(
  accessToken,
  memoryId,
  questionKey,
  input,
) {
  const data = await request(
    memoryId,
    `/questionnaire/answers/${encodeURIComponent(questionKey)}`,
    accessToken,
    {
      method: 'PUT',
      body: input,
    },
  )

  return data.biographyAnswer
}

export async function promoteCreativeChatReply(
  accessToken,
  memoryId,
  messageId,
  input,
) {
  const data = await request(
    memoryId,
    `/creative-messages/${encodeURIComponent(messageId)}`,
    accessToken,
    {
      method: 'POST',
      body: input,
    },
  )

  return data.biographyAnswer
}