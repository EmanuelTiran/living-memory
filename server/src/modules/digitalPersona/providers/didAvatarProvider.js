import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '../../../config/env.js'
import { AppError } from '../../../errors/AppError.js'

const DID_API_BASE_URL =
  'https://api.d-id.com'

export const DID_AUDIO_MAX_SIZE_BYTES =
  6 * 1024 * 1024

export const DID_VIDEO_MAX_SIZE_BYTES =
  50 * 1024 * 1024

const DID_IMAGE_MAX_SIZE_BYTES =
  10 * 1024 * 1024

const completedStatuses = new Set([
  'done',
])

const failedStatuses = new Set([
  'error',
  'failed',
  'rejected',
])

function createProviderError(
  code = 'DID_PROVIDER_ERROR',
  statusCode = 502,
) {
  return new AppError(
    'The avatar video service is temporarily unavailable.',
    {
      statusCode,
      code,
    },
  )
}

function createResponseError(status) {
  if (status === 401 || status === 403) {
    return createProviderError(
      'DID_AUTHENTICATION_FAILED',
      503,
    )
  }

  if (status === 402) {
    return createProviderError(
      'DID_BILLING_REQUIRED',
      402,
    )
  }

  if (status === 418) {
    return createProviderError(
      'DID_VIDEO_DOWNLOAD_BLOCKED',
      502,
    )
  }

  if (status === 429) {
    return createProviderError(
      'DID_RATE_LIMITED',
      429,
    )
  }

  if (status === 451) {
    return createProviderError(
      'DID_MEDIA_REJECTED',
      422,
    )
  }

  return createProviderError()
}

function createTimeoutError() {
  return createProviderError(
    'DID_PROVIDER_TIMEOUT',
    504,
  )
}

function detectImageContentType(buffer) {
  const signature = [
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
  ]

  if (
    Buffer.isBuffer(buffer) &&
    buffer.length >= signature.length &&
    signature.every(
      (value, index) =>
        buffer[index] === value,
    )
  ) {
    return 'image/png'
  }

  if (
    Buffer.isBuffer(buffer) &&
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg'
  }

  if (
    Buffer.isBuffer(buffer) &&
    buffer.length >= 12 &&
    buffer
      .subarray(0, 4)
      .toString('ascii') === 'RIFF' &&
    buffer
      .subarray(8, 12)
      .toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }

  return ''
}

function isMp4(buffer) {
  return (
    Buffer.isBuffer(buffer) &&
    buffer.length >= 12 &&
    buffer
      .subarray(4, 8)
      .toString('ascii') === 'ftyp'
  )
}

async function readAvatarImage(imagePath) {
  try {
    return await readFile(
      path.resolve(imagePath),
    )
  } catch {
    throw createProviderError(
      'DID_AVATAR_IMAGE_INVALID',
      503,
    )
  }
}

function createAuthorizationHeader(
  apiKey,
  apiKeyMode,
) {
  if (
    typeof apiKey !== 'string' ||
    apiKey.trim().length === 0
  ) {
    throw createProviderError(
      'DID_NOT_CONFIGURED',
      503,
    )
  }

  const normalizedKey = apiKey.trim()

  const credential =
    apiKeyMode === 'PRE_ENCODED'
      ? normalizedKey
      : Buffer.from(
          normalizedKey,
          'utf8',
        ).toString('base64')

  return `Basic ${credential}`
}

async function fetchWithTimeout(
  fetchImplementation,
  url,
  options,
  timeoutMs,
) {
  const abortController =
    new AbortController()

  const timeoutHandle = setTimeout(
    () => abortController.abort(),
    timeoutMs,
  )

  try {
    return await fetchImplementation(
      url,
      {
        ...options,
        signal: abortController.signal,
      },
    )
  } catch (error) {
    if (
      error?.name === 'AbortError' ||
      abortController.signal.aborted
    ) {
      throw createTimeoutError()
    }

    throw createProviderError()
  } finally {
    clearTimeout(timeoutHandle)
  }
}

async function readJsonResponse(response) {
  try {
    return await response.json()
  } catch {
    throw createProviderError(
      'DID_INVALID_RESPONSE',
      502,
    )
  }
}

async function requestJson({
  fetchImplementation,
  authorization,
  pathname,
  method = 'GET',
  body,
  timeoutMs,
  expectedStatuses,
}) {
  const headers = {
    Authorization: authorization,
    Accept: 'application/json',
  }

  if (
    body !== undefined &&
    !(body instanceof FormData)
  ) {
    headers['Content-Type'] =
      'application/json'
  }

  const response = await fetchWithTimeout(
    fetchImplementation,
    `${DID_API_BASE_URL}${pathname}`,
    {
      method,
      headers,
      body:
        body instanceof FormData
          ? body
          : body === undefined
            ? undefined
            : JSON.stringify(body),
    },
    timeoutMs,
  )

  if (
    !expectedStatuses.includes(
      response.status,
    )
  ) {
    throw createResponseError(
      response.status,
    )
  }

  if (response.status === 204) {
    return null
  }

  return readJsonResponse(response)
}

function getUploadedResource(data) {
  const id = data?.id
  const url =
    data?.url ??
    data?.result_url ??
    data?.source_url

  if (
    typeof id !== 'string' ||
    id.length === 0 ||
    typeof url !== 'string' ||
    !/^(?:https|s3):\/\//i.test(url)
  ) {
    throw createProviderError(
      'DID_INVALID_RESPONSE',
      502,
    )
  }

  return {
    id,
    url,
  }
}

async function uploadImage(
  imageBuffer,
  imageContentType,
  context,
) {
  const form = new FormData()

  const extension = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }[imageContentType]

  form.append(
    'image',
    new Blob([imageBuffer], {
      type: imageContentType,
    }),
    `living-memory-avatar.${extension}`,
  )

  const data = await requestJson({
    ...context,
    pathname: '/images',
    method: 'POST',
    body: form,
    expectedStatuses: [201],
  })

  return getUploadedResource(data)
}

async function uploadAudio(
  audioBuffer,
  contentType,
  context,
) {
  const extension =
    contentType === 'audio/wav'
      ? 'wav'
      : 'mp3'

  const form = new FormData()

  form.append(
    'audio',
    new Blob([audioBuffer], {
      type: contentType,
    }),
    `living-memory-audio.${extension}`,
  )

  const data = await requestJson({
    ...context,
    pathname: '/audios',
    method: 'POST',
    body: form,
    expectedStatuses: [201],
  })

  return getUploadedResource(data)
}

async function createTalk(
  imageUrl,
  audioUrl,
  context,
) {
  const data = await requestJson({
    ...context,
    pathname: '/talks',
    method: 'POST',
    body: {
      source_url: imageUrl,
      script: {
        type: 'audio',
        audio_url: audioUrl,
      },
      name:
        'Living Memory avatar response',
    },
    expectedStatuses: [201],
  })

  if (
    typeof data?.id !== 'string' ||
    data.id.length === 0
  ) {
    throw createProviderError(
      'DID_INVALID_RESPONSE',
      502,
    )
  }

  return data.id
}

async function waitForTalk(
  talkId,
  context,
  pollIntervalMs,
  pollTimeoutMs,
  pollDelay,
) {
  const maximumPolls = Math.ceil(
    pollTimeoutMs / pollIntervalMs,
  )

  for (
    let attempt = 0;
    attempt < maximumPolls;
    attempt += 1
  ) {
    const talk = await requestJson({
      ...context,
      pathname:
        `/talks/${encodeURIComponent(talkId)}`,
      expectedStatuses: [200],
    })

    const status = String(
      talk?.status ?? '',
    ).toLowerCase()

    if (completedStatuses.has(status)) {
      if (
        typeof talk?.result_url !==
          'string' ||
        !/^https:\/\//i.test(
          talk.result_url,
        )
      ) {
        throw createProviderError(
          'DID_INVALID_RESPONSE',
          502,
        )
      }

      return talk.result_url
    }

    if (failedStatuses.has(status)) {
      throw createProviderError(
        'DID_GENERATION_FAILED',
        502,
      )
    }

    await pollDelay(pollIntervalMs)
  }

  throw createTimeoutError()
}

async function downloadVideo(
  resultUrl,
  {
    fetchImplementation,
    timeoutMs,
    maxVideoBytes,
  },
) {
  const response = await fetchWithTimeout(
    fetchImplementation,
    resultUrl,
    {
      method: 'GET',
      headers: {
        Accept: 'video/mp4',
      },
    },
    timeoutMs,
  )

  if (!response.ok) {
    throw createResponseError(
      response.status,
    )
  }

  const contentType =
    response.headers
      .get('content-type')
      ?.split(';')[0]
      .trim()
      .toLowerCase()

  if (contentType !== 'video/mp4') {
    throw createProviderError(
      'DID_INVALID_VIDEO',
      502,
    )
  }

  const videoBuffer = Buffer.from(
    await response.arrayBuffer(),
  )

  if (
    videoBuffer.length === 0 ||
    videoBuffer.length >
      maxVideoBytes ||
    !isMp4(videoBuffer)
  ) {
    videoBuffer.fill(0)

    throw createProviderError(
      'DID_INVALID_VIDEO',
      502,
    )
  }

  return videoBuffer
}

async function deleteResource(
  pathname,
  context,
) {
  try {
    await requestJson({
      ...context,
      pathname,
      method: 'DELETE',
      expectedStatuses: [
        200,
        204,
        404,
        409,
      ],
    })
  } catch {
    // Temporary D-ID resources also expire automatically.
  }
}

function validateAudioInput(
  audioBuffer,
  audioContentType,
) {
  if (
    !Buffer.isBuffer(audioBuffer) ||
    audioBuffer.length === 0 ||
    audioBuffer.length >
      DID_AUDIO_MAX_SIZE_BYTES ||
    ![
      'audio/mpeg',
      'audio/wav',
    ].includes(audioContentType)
  ) {
    throw createProviderError(
      'DID_AUDIO_NOT_SUPPORTED',
      422,
    )
  }
}

function createProviderContext({
  fetchImplementation,
  apiKey,
  apiKeyMode,
  timeoutMs,
}) {
  if (
    typeof fetchImplementation !==
    'function'
  ) {
    throw new TypeError(
      'A fetch implementation is required.',
    )
  }

  return {
    fetchImplementation,
    authorization:
      createAuthorizationHeader(
        apiKey,
        apiKeyMode,
      ),
    timeoutMs,
  }
}

export function isDIDAvatarProviderConfigured() {
  return Boolean(env.didApiKey)
}

export function isDIDRealtimeAvatarConfigured() {
  return Boolean(
    env.didApiKey &&
      env.didAgentId &&
      env.didClientKey,
  )
}

export async function createDIDRealtimeAudio(
  {
    audioBuffer,
    audioContentType,
  },
  {
    fetchImplementation = globalThis.fetch,
    apiKey = env.didApiKey,
    apiKeyMode = env.didApiKeyMode,
    timeoutMs = env.didTimeoutMs,
  } = {},
) {
  validateAudioInput(
    audioBuffer,
    audioContentType,
  )

  const context = createProviderContext({
    fetchImplementation,
    apiKey,
    apiKeyMode,
    timeoutMs,
  })

  const resource = await uploadAudio(
    audioBuffer,
    audioContentType,
    context,
  )

  if (!/^(?:https|s3):\/\//i.test(resource.url)) {
    await deleteResource(
      `/audios/${encodeURIComponent(resource.id)}`,
      context,
    )

    throw createProviderError(
      'DID_INVALID_RESPONSE',
      502,
    )
  }

  return {
    resourceId: resource.id,
    audioUrl: resource.url,
  }
}

export async function deleteDIDRealtimeAudio(
  resourceId,
  {
    fetchImplementation = globalThis.fetch,
    apiKey = env.didApiKey,
    apiKeyMode = env.didApiKeyMode,
    timeoutMs = env.didTimeoutMs,
  } = {},
) {
  if (
    typeof resourceId !== 'string' ||
    resourceId.length === 0 ||
    resourceId.length > 500 ||
    [...resourceId].some(
      (character) =>
        character.charCodeAt(0) < 32,
    )
  ) {
    return
  }

  const context = createProviderContext({
    fetchImplementation,
    apiKey,
    apiKeyMode,
    timeoutMs,
  })

  await deleteResource(
    `/audios/${encodeURIComponent(resourceId)}`,
    context,
  )
}

export async function generateDIDAvatarVideo(
  {
    audioBuffer,
    audioContentType,
    imageBuffer,
    imageContentType,
  },
  {
    fetchImplementation = globalThis.fetch,
    apiKey = env.didApiKey,
    apiKeyMode = env.didApiKeyMode,
    imagePath =
      env.didAvatarImagePath,
    imageBuffer:
      configuredImageBuffer,
    imageContentType:
      configuredImageContentType,
    timeoutMs = env.didTimeoutMs,
    pollIntervalMs =
      env.didPollIntervalMs,
    pollTimeoutMs =
      env.didPollTimeoutMs,
    maxVideoBytes =
      DID_VIDEO_MAX_SIZE_BYTES,
    pollDelay = (durationMs) =>
      new Promise((resolve) => {
        setTimeout(resolve, durationMs)
      }),
  } = {},
) {
  validateAudioInput(
    audioBuffer,
    audioContentType,
  )

  const resolvedImageBuffer =
    imageBuffer ??
    configuredImageBuffer ??
    await readAvatarImage(imagePath)

  const resolvedImageContentType =
    imageContentType ??
    configuredImageContentType

  const detectedImageContentType =
    detectImageContentType(
      resolvedImageBuffer,
    )

  if (
    !detectedImageContentType ||
    (
      resolvedImageContentType &&
      resolvedImageContentType !==
        detectedImageContentType
    ) ||
    resolvedImageBuffer.length >
      DID_IMAGE_MAX_SIZE_BYTES
  ) {
    throw createProviderError(
      'DID_AVATAR_IMAGE_INVALID',
      503,
    )
  }

  const context = createProviderContext({
    fetchImplementation,
    apiKey,
    apiKeyMode,
    timeoutMs,
  })

  let imageResource
  let audioResource
  let talkId

  try {
    imageResource = await uploadImage(
      resolvedImageBuffer,
      detectedImageContentType,
      context,
    )

    audioResource = await uploadAudio(
      audioBuffer,
      audioContentType,
      context,
    )

    talkId = await createTalk(
      imageResource.url,
      audioResource.url,
      context,
    )

    const resultUrl = await waitForTalk(
      talkId,
      context,
      pollIntervalMs,
      pollTimeoutMs,
      pollDelay,
    )

    const videoBuffer =
      await downloadVideo(
        resultUrl,
        {
          fetchImplementation,
          timeoutMs,
          maxVideoBytes,
        },
      )

    return {
      videoBuffer,
      byteLength: videoBuffer.length,
      contentType: 'video/mp4',
      fileExtension: 'mp4',
      provider: 'd-id',
      isAiGenerated: true,
    }
  } finally {
    if (talkId) {
      await deleteResource(
        `/talks/${encodeURIComponent(talkId)}`,
        context,
      )
    }

    if (audioResource?.id) {
      await deleteResource(
        `/audios/${encodeURIComponent(audioResource.id)}`,
        context,
      )
    }

    if (imageResource?.id) {
      await deleteResource(
        `/images/${encodeURIComponent(imageResource.id)}`,
        context,
      )
    }
  }
}
