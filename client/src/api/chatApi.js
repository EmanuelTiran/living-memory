import { ApiError } from './authApi.js'

function createChatBasePath(memoryId) {
  return `/api/memories/${encodeURIComponent(memoryId)}/chat`
}

async function parseErrorResponse(response) {
  const payload = await response
    .json()
    .catch(() => null)

  return new ApiError(
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

  if (!response.ok) {
    throw await parseErrorResponse(
      response,
    )
  }

  const payload =
    response.status === 204
      ? null
      : await response
          .json()
          .catch(() => null)

  return payload?.data ?? null
}

async function requestSpeech(
  memoryId,
  path,
  accessToken,
  {
    includeAvatarJob = false,
    includeRealtimeAvatar = false,
    includeRealtimeChunk = false,
  } = {},
) {
  let response

  try {
    response = await fetch(
      `${createChatBasePath(memoryId)}${path}`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept:
            'audio/mpeg, audio/wav',
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
    throw await parseErrorResponse(
      response,
    )
  }

  const contentType =
    response.headers
      .get('content-type')
      ?.split(';')[0]
      .trim()
      .toLowerCase()

  const isAiGenerated =
    response.headers.get(
      'x-ai-generated-audio',
    ) === 'true'

  if (
    ![
      'audio/mpeg',
      'audio/wav',
    ].includes(contentType) ||
    !isAiGenerated
  ) {
    throw new ApiError(
      'The server returned invalid speech audio.',
      {
        statusCode: response.status,
        code:
          'AI_SPEECH_INVALID_RESPONSE',
      },
    )
  }

  let audioBlob

  try {
    audioBlob = await response.blob()
  } catch {
    throw new ApiError(
      'The speech audio could not be read.',
      {
        statusCode: response.status,
        code:
          'AI_SPEECH_INVALID_RESPONSE',
      },
    )
  }

  if (audioBlob.size === 0) {
    throw new ApiError(
      'The server returned empty speech audio.',
      {
        statusCode: response.status,
        code:
          'AI_SPEECH_INVALID_RESPONSE',
      },
    )
  }

  if (
    !includeAvatarJob &&
    !includeRealtimeAvatar &&
    !includeRealtimeChunk
  ) {
    return audioBlob
  }

  if (
    includeRealtimeAvatar ||
    includeRealtimeChunk
  ) {
    const realtimeAudioUrl =
      response.headers.get(
        'x-did-realtime-audio-url',
      )
    const realtimeReleaseToken =
      response.headers.get(
        'x-did-realtime-release-token',
      )

    if (
      !realtimeAudioUrl ||
      !/^(?:https|s3):\/\//i.test(
        realtimeAudioUrl,
      ) ||
      !realtimeReleaseToken
    ) {
      throw new ApiError(
        'The server did not return realtime avatar audio metadata.',
        {
          statusCode: response.status,
          code:
            'DID_REALTIME_INVALID_RESPONSE',
        },
      )
    }

    const realtimeResult = {
      audioBlob,
      realtimeAudioUrl,
      realtimeReleaseToken,
    }

    if (!includeRealtimeChunk) {
      return realtimeResult
    }

    const chunkIndex = Number.parseInt(
      response.headers.get(
        'x-did-realtime-chunk-index',
      ) ?? '',
      10,
    )
    const chunkCount = Number.parseInt(
      response.headers.get(
        'x-did-realtime-chunk-count',
      ) ?? '',
      10,
    )

    if (
      !Number.isInteger(chunkIndex) ||
      chunkIndex < 0 ||
      !Number.isInteger(chunkCount) ||
      chunkCount < 1 ||
      chunkIndex >= chunkCount
    ) {
      throw new ApiError(
        'The server returned invalid realtime speech chunk metadata.',
        {
          statusCode: response.status,
          code:
            'DID_REALTIME_INVALID_RESPONSE',
        },
      )
    }

    return {
      ...realtimeResult,
      chunkIndex,
      chunkCount,
    }
  }

  const avatarJobId =
    response.headers.get(
      'x-avatar-job-id',
    )

  if (!avatarJobId) {
    throw new ApiError(
      'The server did not return an avatar job identifier.',
      {
        statusCode: response.status,
        code:
          'DID_AVATAR_INVALID_RESPONSE',
      },
    )
  }

  return {
    audioBlob,
    avatarJobId,
  }
}

async function requestVoiceInputTranscription(
  memoryId,
  accessToken,
  audioBlob,
  fileName,
) {
  const formData = new FormData()

  formData.append(
    'audio',
    audioBlob,
    fileName,
  )

  let response

  try {
    response = await fetch(
      `${createChatBasePath(memoryId)}/voice-input/transcription`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          Authorization:
            `Bearer ${accessToken}`,
        },
        body: formData,
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
    throw await parseErrorResponse(
      response,
    )
  }

  const payload = await response
    .json()
    .catch(() => null)

  const transcript =
    payload?.data?.transcript

  if (
    typeof transcript?.text !==
      'string' ||
    !transcript.text.trim() ||
    transcript.autoSent !== false ||
    transcript.audioStored !== false
  ) {
    throw new ApiError(
      'The server returned an invalid voice-input transcript.',
      {
        statusCode: response.status,
        code:
          'CHAT_VOICE_INPUT_INVALID_RESPONSE',
      },
    )
  }

  return transcript
}

async function requestAvatarVideo(
  memoryId,
  avatarJobId,
  accessToken,
) {
  let response

  try {
    response = await fetch(
      `${createChatBasePath(memoryId)}/avatar-jobs/${encodeURIComponent(avatarJobId)}/video`,
      {
        credentials: 'include',
        headers: {
          Accept: 'video/mp4',
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
    throw await parseErrorResponse(response)
  }

  const contentType = response.headers
    .get('content-type')
    ?.split(';')[0]
    .trim()
    .toLowerCase()

  const isAiGenerated =
    response.headers.get(
      'x-ai-generated-video',
    ) === 'true'

  if (
    contentType !== 'video/mp4' ||
    !isAiGenerated
  ) {
    throw new ApiError(
      'The server returned invalid avatar video.',
      {
        statusCode: response.status,
        code:
          'DID_AVATAR_INVALID_RESPONSE',
      },
    )
  }

  const videoBlob = await response.blob()

  if (videoBlob.size === 0) {
    throw new ApiError(
      'The server returned empty avatar video.',
      {
        statusCode: response.status,
        code:
          'DID_AVATAR_INVALID_RESPONSE',
      },
    )
  }

  return videoBlob
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

export function transcribeMemoryChatVoiceInput(
  accessToken,
  memoryId,
  audioBlob,
  fileName,
) {
  return requestVoiceInputTranscription(
    memoryId,
    accessToken,
    audioBlob,
    fileName,
  )
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

export function getMemoryChatMessageSpeech(
  accessToken,
  memoryId,
  conversationId,
  messageId,
) {
  return requestSpeech(
    memoryId,
    `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/speech`,
    accessToken,
  )
}

export function getMemoryChatMessageAvatarSpeech(
  accessToken,
  memoryId,
  conversationId,
  messageId,
) {
  return requestSpeech(
    memoryId,
    `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/avatar-speech`,
    accessToken,
    {
      includeAvatarJob: true,
    },
  )
}

export function getMemoryChatMessageRealtimeAvatarSpeech(
  accessToken,
  memoryId,
  conversationId,
  messageId,
) {
  return requestSpeech(
    memoryId,
    `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/realtime-avatar-speech`,
    accessToken,
    {
      includeRealtimeAvatar: true,
    },
  )
}

export function getMemoryChatMessageRealtimeAvatarSpeechChunk(
  accessToken,
  memoryId,
  conversationId,
  messageId,
  chunkIndex,
) {
  return requestSpeech(
    memoryId,
    `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/realtime-avatar-speech/chunks/${encodeURIComponent(chunkIndex)}`,
    accessToken,
    {
      includeRealtimeChunk: true,
    },
  )
}

export function releaseMemoryChatRealtimeAvatarAudio(
  accessToken,
  memoryId,
  realtimeAudioToken,
) {
  return request(
    memoryId,
    `/realtime-audio/${encodeURIComponent(realtimeAudioToken)}`,
    accessToken,
    {
      method: 'DELETE',
    },
  )
}

export function getMemoryChatAvatarJobStatus(
  accessToken,
  memoryId,
  avatarJobId,
) {
  return request(
    memoryId,
    `/avatar-jobs/${encodeURIComponent(avatarJobId)}`,
    accessToken,
  ).then((data) => data.avatarJob)
}

export function getMemoryChatAvatarVideo(
  accessToken,
  memoryId,
  avatarJobId,
) {
  return requestAvatarVideo(
    memoryId,
    avatarJobId,
    accessToken,
  )
}
