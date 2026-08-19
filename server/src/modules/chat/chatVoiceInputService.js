import { env } from '../../config/env.js'
import { AppError } from '../../errors/AppError.js'
import ConsentRecord, {
  EXTERNAL_TRANSCRIPTION_CONSENT_POLICY_VERSION,
} from '../digitalPersona/ConsentRecord.js'
import {
  MEMORY_PERMISSIONS,
  requireMemoryPermission,
} from '../memories/memoryAccessService.js'
import {
  transcribeRecordingWithOpenAI,
} from '../media/openaiTranscriptionProvider.js'
import {
  CHAT_USER_MESSAGE_MAX_LENGTH,
  chatMemoryParamsSchema,
} from './validation.js'

function validateUserId(userId) {
  if (
    typeof userId !== 'string' ||
    userId.length === 0
  ) {
    throw new TypeError(
      'User ID must be a non-empty string.',
    )
  }
}

function validateAudioFile(file) {
  if (
    !file ||
    !Buffer.isBuffer(file.buffer) ||
    file.buffer.length === 0 ||
    typeof file.mimetype !== 'string'
  ) {
    throw new TypeError(
      'Chat voice input requires a valid audio file.',
    )
  }

  return file
}

function createConsentRequiredError() {
  return new AppError(
    'Approved OpenAI chat voice-input consent is required.',
    {
      statusCode: 409,
      code:
        'CHAT_VOICE_INPUT_CONSENT_REQUIRED',
    },
  )
}

function createNotConfiguredError() {
  return new AppError(
    'OpenAI chat transcription is not configured.',
    {
      statusCode: 503,
      code:
        'CHAT_VOICE_INPUT_NOT_CONFIGURED',
    },
  )
}

function getSafeFileName(mimeType) {
  const extensions = {
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/x-m4a': '.m4a',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
    'audio/webm': '.webm',
  }

  return `chat-voice-input${
    extensions[mimeType] ?? '.audio'
  }`
}

export function createChatVoiceInputTranscriber({
  transcribe =
    transcribeRecordingWithOpenAI,
} = {}) {
  if (typeof transcribe !== 'function') {
    throw new TypeError(
      'Chat voice-input transcriber must be a function.',
    )
  }

  return async function transcribeChatVoiceInput(
    userId,
    memoryId,
    file,
  ) {
    validateUserId(userId)

    const validatedMemoryId =
      chatMemoryParamsSchema.parse({
        memoryId,
      }).memoryId

    const validatedFile =
      validateAudioFile(file)

    await requireMemoryPermission(
      userId,
      validatedMemoryId,
      MEMORY_PERMISSIONS.MANAGE,
    )

    if (
      !env.openaiApiKey ||
      !env.openaiTranscriptionModel
    ) {
      throw createNotConfiguredError()
    }

    const consent =
      await ConsentRecord.findOne({
        memoryId: validatedMemoryId,
        status: 'approved',
        subjectStatus: 'living',
        relationshipToSubject: 'self',
        'externalTranscriptionConsent.provider':
          'openai',
        'externalTranscriptionConsent.model':
          env.openaiTranscriptionModel,
        'externalTranscriptionConsent.languageCode':
          'he',
        'externalTranscriptionConsent.policyVersion':
          EXTERNAL_TRANSCRIPTION_CONSENT_POLICY_VERSION,
      })
        .select({
          _id: 1,
        })
        .lean()

    if (!consent) {
      throw createConsentRequiredError()
    }

    const result = await transcribe({
      audioBuffer:
        validatedFile.buffer,
      originalFileName:
        getSafeFileName(
          validatedFile.mimetype,
        ),
      mimeType:
        validatedFile.mimetype,
      languageCode: 'he',
    })

    const text =
      typeof result?.content === 'string'
        ? result.content.trim()
        : ''

    if (!text) {
      throw new AppError(
        'Chat voice input returned an empty transcript.',
        {
          statusCode: 502,
          code:
            'CHAT_VOICE_INPUT_EMPTY_TRANSCRIPT',
        },
      )
    }

    if (
      text.length >
      CHAT_USER_MESSAGE_MAX_LENGTH
    ) {
      throw new AppError(
        'Chat voice input transcript is too long for the message composer.',
        {
          statusCode: 422,
          code:
            'CHAT_VOICE_INPUT_TRANSCRIPT_TOO_LONG',
        },
      )
    }

    return Object.freeze({
      text,
      languageCode: 'he',
      audioStored: false,
      autoSent: false,
    })
  }
}

export const transcribeChatVoiceInput =
  createChatVoiceInputTranscriber()
