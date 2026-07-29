import { toFile } from 'openai'
import { env } from '../../config/env.js'
import { AppError } from '../../errors/AppError.js'
import {
  MAX_RECORDING_SIZE_BYTES,
  RECORDING_MIME_TYPES,
} from './MemoryRecording.js'
import { RECORDING_TRANSCRIPT_MAX_LENGTH } from './MemoryRecordingTranscript.js'
import { getOpenAIClient } from '../chat/openaiClient.js'
import { prepareRecordingForTranscription } from './transcriptionAudioPreparer.js'

const languageCodePattern =
  /^[a-z]{2,3}(?:-[A-Z]{2})?$/

function createProviderError(
  message,
  {
    statusCode,
    code,
  },
) {
  return new AppError(message, {
    statusCode,
    code,
  })
}

function normalizeLanguageCode(
  languageCode,
) {
  if (
    typeof languageCode !==
    'string'
  ) {
    throw new TypeError(
      'Transcription language must be a string.',
    )
  }

  const normalizedLanguageCode =
    languageCode.trim()

  if (
    !languageCodePattern.test(
      normalizedLanguageCode,
    )
  ) {
    throw new TypeError(
      'Transcription language code is invalid.',
    )
  }

  return normalizedLanguageCode
}

function getBaseLanguageCode(
  languageCode,
) {
  return languageCode
    .split('-')[0]
    .toLowerCase()
}

function validateAudioInput({
  audioBuffer,
  originalFileName,
  mimeType,
  languageCode,
}) {
  if (
    !Buffer.isBuffer(audioBuffer) ||
    audioBuffer.length === 0
  ) {
    throw new TypeError(
      'Transcription requires a non-empty audio buffer.',
    )
  }

  if (
    audioBuffer.length >
    MAX_RECORDING_SIZE_BYTES
  ) {
    throw new TypeError(
      'Transcription audio must not exceed 25 MB.',
    )
  }

  if (
    typeof originalFileName !==
      'string' ||
    originalFileName.trim()
      .length === 0 ||
    originalFileName.trim()
      .length > 255
  ) {
    throw new TypeError(
      'Transcription requires a valid original file name.',
    )
  }

  if (
    !RECORDING_MIME_TYPES.includes(
      mimeType,
    )
  ) {
    throw new TypeError(
      'Transcription audio type is not supported.',
    )
  }

  return {
    audioBuffer,

    originalFileName:
      originalFileName.trim(),

    mimeType,

    languageCode:
      normalizeLanguageCode(
        languageCode,
      ),
  }
}

function validateProviderConfiguration({
  getClient,
  fileFactory,
  prepareAudio,
  model,
  timeoutMs,
}) {
  if (
    typeof getClient !==
    'function'
  ) {
    throw new TypeError(
      'OpenAI client provider must be a function.',
    )
  }

  if (
    typeof fileFactory !==
    'function'
  ) {
    throw new TypeError(
      'OpenAI file factory must be a function.',
    )
  }

  if (
    typeof prepareAudio !==
    'function'
  ) {
    throw new TypeError(
      'Transcription audio preparer must be a function.',
    )
  }

  if (
    typeof model !== 'string' ||
    model.trim().length === 0
  ) {
    throw new TypeError(
      'OpenAI transcription model must be configured.',
    )
  }

  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 5000 ||
    timeoutMs > 300000
  ) {
    throw new TypeError(
      'OpenAI transcription timeout must be between 5000 and 300000 milliseconds.',
    )
  }

  return {
    getClient,
    fileFactory,
    prepareAudio,
    model: model.trim(),
    timeoutMs,
  }
}

function resolveResponseLanguage(
  response,
  requestedLanguageCode,
) {
  const detectedLanguageCode =
    response?.languages?.find(
      (language) =>
        typeof language?.code ===
          'string' &&
        /^[a-z]{2,3}$/i.test(
          language.code.trim(),
        ),
    )?.code

  return detectedLanguageCode
    ? detectedLanguageCode
        .trim()
        .toLowerCase()
    : requestedLanguageCode
}

function resolveProviderResponseId(
  response,
) {
  if (
    typeof response?.id !==
    'string'
  ) {
    return ''
  }

  return response.id
    .trim()
    .slice(0, 200)
}

function mapOpenAIError(error) {
  if (error instanceof AppError) {
    return error
  }

  const errorName =
    typeof error?.name === 'string'
      ? error.name
      : ''

  const errorCode =
    typeof error?.code === 'string'
      ? error.code
      : ''

  if (
    errorName ===
      'APIConnectionTimeoutError' ||
    errorName === 'AbortError' ||
    errorCode === 'ETIMEDOUT'
  ) {
    return createProviderError(
      'Recording transcription timed out.',
      {
        statusCode: 504,
        code:
          'TRANSCRIPTION_PROVIDER_TIMEOUT',
      },
    )
  }

  if (
    error?.status === 429 ||
    error?.status === 503
  ) {
    return createProviderError(
      'The transcription service is temporarily unavailable.',
      {
        statusCode: 503,
        code:
          'TRANSCRIPTION_PROVIDER_UNAVAILABLE',
      },
    )
  }

  return createProviderError(
    'Recording transcription could not be completed.',
    {
      statusCode: 502,
      code:
        'TRANSCRIPTION_PROVIDER_ERROR',
    },
  )
}

export function createOpenAITranscriptionProvider(
  {
    getClient = getOpenAIClient,
    fileFactory = toFile,

    prepareAudio =
      prepareRecordingForTranscription,

    model =
      env.openaiTranscriptionModel,

    timeoutMs =
      env.openaiTranscriptionTimeoutMs,
  } = {},
) {
  const configuration =
    validateProviderConfiguration({
      getClient,
      fileFactory,
      prepareAudio,
      model,
      timeoutMs,
    })

  return async function transcribeRecording({
    audioBuffer,
    originalFileName,
    mimeType,
    languageCode,
  }) {
    const validatedInput =
      validateAudioInput({
        audioBuffer,
        originalFileName,
        mimeType,
        languageCode,
      })

    let preparedInput = null

    try {
      preparedInput =
        await configuration.prepareAudio(
          validatedInput,
        )

      const client =
        configuration.getClient()

      const audioFile =
        await configuration.fileFactory(
          preparedInput.audioBuffer,
          preparedInput.originalFileName,
          {
            type:
              preparedInput.mimeType,
          },
        )

      const request = {
        file: audioFile,
        model: configuration.model,
      }

      const requestOptions = {
        timeout:
          configuration.timeoutMs,
      }

      if (
        configuration.model ===
        'gpt-transcribe'
      ) {
        requestOptions.body = {
          ...request,

          languages: [
            getBaseLanguageCode(
              validatedInput.languageCode,
            ),
          ],
        }
      } else {
        request.language =
          getBaseLanguageCode(
            validatedInput.languageCode,
          )
      }

      const response =
        await client.audio.transcriptions.create(
          request,
          requestOptions,
        )

      const content =
        typeof response?.text ===
        'string'
          ? response.text.trim()
          : ''

      if (content.length === 0) {
        throw createProviderError(
          'The transcription service returned an empty transcript.',
          {
            statusCode: 502,
            code:
              'TRANSCRIPTION_EMPTY_RESPONSE',
          },
        )
      }

      if (
        content.length >
        RECORDING_TRANSCRIPT_MAX_LENGTH
      ) {
        throw createProviderError(
          'The generated transcript is too large to store safely.',
          {
            statusCode: 502,
            code:
              'TRANSCRIPTION_RESPONSE_TOO_LARGE',
          },
        )
      }

      return {
        content,

        languageCode:
          resolveResponseLanguage(
            response,
            validatedInput.languageCode,
          ),

        provider: 'openai',
        model: configuration.model,

        providerResponseId:
          resolveProviderResponseId(
            response,
          ),
      }
    } catch (error) {
      throw mapOpenAIError(error)
    } finally {
      try {
        preparedInput?.release()
      } catch {
        // The original recording buffer is cleared by the caller.
      }
    }
  }
}

export const transcribeRecordingWithOpenAI =
  createOpenAITranscriptionProvider()