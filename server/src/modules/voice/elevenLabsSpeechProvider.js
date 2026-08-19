import { Buffer } from 'node:buffer'
import { z } from 'zod'
import { env } from '../../config/env.js'
import { AppError } from '../../errors/AppError.js'

export const ELEVENLABS_TEXT_MAX_LENGTH =
  2000

export const ELEVENLABS_AUDIO_MAX_SIZE_BYTES =
  25 * 1024 * 1024

export const AI_CLONED_VOICE_DISCLOSURE =
  'זהו קול שנוצר בבינה מלאכותית משכפול קול שאושר במפורש. ההקלטה אינה אמירה חדשה או בזמן אמת של האדם.'

const voiceIdSchema = z
  .string({
    error:
      'ElevenLabs voice ID must be a string.',
  })
  .trim()
  .regex(/^[A-Za-z0-9_-]{10,100}$/, {
    error:
      'ElevenLabs voice ID is invalid.',
  })

const requestSchema = z.strictObject({
  text: z
    .string({
      error:
        'Cloned speech text must be a string.',
    })
    .trim()
    .min(1, {
      error:
        'Cloned speech text must not be empty.',
    })
    .max(ELEVENLABS_TEXT_MAX_LENGTH, {
      error:
        `Cloned speech text must not exceed ${ELEVENLABS_TEXT_MAX_LENGTH} characters.`,
    }),

  voiceId: voiceIdSchema,
})

const configurationSchema =
  z.strictObject({
    apiKey: z
      .string()
      .trim()
      .min(1),

    model: z.literal('eleven_v3'),

    timeoutMs: z
      .number()
      .int()
      .min(10000)
      .max(300000),

    maxAudioBytes: z
      .number()
      .int()
      .min(1)
      .max(
        ELEVENLABS_AUDIO_MAX_SIZE_BYTES,
      ),
  })

function createNotConfiguredError() {
  return new AppError(
    'The cloned voice service is not configured.',
    {
      statusCode: 503,
      code:
        'VOICE_CLONE_NOT_CONFIGURED',
    },
  )
}

function createProviderError() {
  return new AppError(
    'The cloned voice service is temporarily unavailable.',
    {
      statusCode: 502,
      code:
        'VOICE_CLONE_PROVIDER_ERROR',
    },
  )
}

function createProviderResponseError(
  status,
) {
  if (status === 401 || status === 403) {
    return new AppError(
      'The cloned voice service credentials were rejected.',
      {
        statusCode: 503,
        code:
          'VOICE_CLONE_AUTHENTICATION_FAILED',
      },
    )
  }

  if (status === 402) {
    return new AppError(
      'ElevenLabs credit is required before the cloned voice can run.',
      {
        statusCode: 402,
        code:
          'VOICE_CLONE_BILLING_REQUIRED',
      },
    )
  }

  if (status === 429) {
    return new AppError(
      'The cloned voice service is busy. Please try again shortly.',
      {
        statusCode: 429,
        code:
          'VOICE_CLONE_RATE_LIMITED',
      },
    )
  }

  return createProviderError()
}

function createTimeoutError() {
  return new AppError(
    'The cloned voice service did not respond in time.',
    {
      statusCode: 504,
      code:
        'VOICE_CLONE_PROVIDER_TIMEOUT',
    },
  )
}

function createInvalidResponseError() {
  return new AppError(
    'The cloned voice service returned invalid audio.',
    {
      statusCode: 502,
      code:
        'VOICE_CLONE_INVALID_RESPONSE',
    },
  )
}

function isMp3Audio(audioBuffer) {
  if (
    !Buffer.isBuffer(audioBuffer) ||
    audioBuffer.length < 2
  ) {
    return false
  }

  const hasId3Header =
    audioBuffer.length >= 3 &&
    audioBuffer
      .subarray(0, 3)
      .toString('ascii') === 'ID3'

  const hasMpegFrameHeader =
    audioBuffer[0] === 0xff &&
    (audioBuffer[1] & 0xe0) === 0xe0

  return (
    hasId3Header ||
    hasMpegFrameHeader
  )
}

function discardAudioBuffer(audioBuffer) {
  if (Buffer.isBuffer(audioBuffer)) {
    audioBuffer.fill(0)
  }
}

export function isClonedVoiceProviderConfigured() {
  return Boolean(
    env.elevenLabsApiKey &&
      env.elevenLabsVoiceId &&
      env.elevenLabsModelId ===
        'eleven_v3',
  )
}

export async function generateClonedSpeechAudio(
  input,
  {
    fetchImplementation = globalThis.fetch,
    apiKey = env.elevenLabsApiKey,
    model = env.elevenLabsModelId,
    timeoutMs =
      env.elevenLabsTimeoutMs,
    maxAudioBytes =
      ELEVENLABS_AUDIO_MAX_SIZE_BYTES,
  } = {},
) {
  if (!apiKey) {
    throw createNotConfiguredError()
  }

  if (
    typeof fetchImplementation !==
    'function'
  ) {
    throw new TypeError(
      'A fetch implementation is required.',
    )
  }

  const validatedRequest =
    requestSchema.parse(input)

  const validatedConfiguration =
    configurationSchema.parse({
      apiKey,
      model,
      timeoutMs,
      maxAudioBytes,
    })

  const endpoint =
    `https://api.elevenlabs.io/v1/text-to-speech/` +
    `${encodeURIComponent(validatedRequest.voiceId)}` +
    '?output_format=mp3_44100_128'

  const abortController =
    new AbortController()

  const timeoutHandle = setTimeout(
    () => abortController.abort(),
    validatedConfiguration.timeoutMs,
  )

  let response

  try {
    response = await fetchImplementation(
      endpoint,
      {
        method: 'POST',
        headers: {
          'xi-api-key':
            validatedConfiguration.apiKey,
          'Content-Type':
            'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: validatedRequest.text,
          model_id:
            validatedConfiguration.model,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0,
            use_speaker_boost: true,
            speed: 1,
          },
        }),
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

  if (!response?.ok) {
    throw createProviderResponseError(
      response?.status,
    )
  }

  const contentType =
    response.headers
      ?.get?.('content-type')
      ?.split(';')[0]
      .trim()
      .toLowerCase()

  if (contentType !== 'audio/mpeg') {
    throw createInvalidResponseError()
  }

  let audioBuffer

  try {
    audioBuffer = Buffer.from(
      await response.arrayBuffer(),
    )
  } catch {
    throw createProviderError()
  }

  if (
    audioBuffer.length === 0 ||
    audioBuffer.length >
      validatedConfiguration
        .maxAudioBytes ||
    !isMp3Audio(audioBuffer)
  ) {
    discardAudioBuffer(audioBuffer)
    throw createInvalidResponseError()
  }

  return {
    audioBuffer,
    byteLength: audioBuffer.length,
    contentType: 'audio/mpeg',
    fileExtension: 'mp3',
    provider: 'elevenlabs',
    model:
      validatedConfiguration.model,
    voice: 'approved-custom-clone',
    voiceType: 'custom_clone',
    isAiGenerated: true,
    disclosure:
      AI_CLONED_VOICE_DISCLOSURE,
  }
}
