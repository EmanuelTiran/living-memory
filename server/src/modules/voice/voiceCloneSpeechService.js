import { AppError } from '../../errors/AppError.js'
import ConsentRecord from '../digitalPersona/ConsentRecord.js'
import VoiceProfile from '../digitalPersona/VoiceProfile.js'
import {
  ELEVENLABS_TEXT_MAX_LENGTH,
  generateClonedSpeechAudio,
  isClonedVoiceProviderConfigured,
} from './elevenLabsSpeechProvider.js'

function createProfileUnavailableError() {
  return new AppError(
    'The approved cloned voice profile is unavailable.',
    {
      statusCode: 409,
      code:
        'VOICE_CLONE_PROFILE_UNAVAILABLE',
    },
  )
}

function createTextTooLongError() {
  return new AppError(
    'This response is too long for the cloned voice. Ask for a shorter answer and try again.',
    {
      statusCode: 422,
      code:
        'VOICE_CLONE_TEXT_TOO_LONG',
    },
  )
}

function createProviderNotConfiguredError() {
  return new AppError(
    'The cloned voice service is not configured.',
    {
      statusCode: 503,
      code:
        'VOICE_CLONE_NOT_CONFIGURED',
    },
  )
}

async function findActiveVoiceProfile(
  memoryId,
) {
  const query = VoiceProfile.findOne({
    memoryId,
    provider: 'elevenlabs',
    profileType: 'custom',
    status: 'ready',
    isRealVoiceClone: true,
  })
    .select({
      consentRecordId: 1,
      providerProfileId: 1,
    })
    .lean()

  return query
}

async function findMatchingConsent(
  memoryId,
  voiceProfile,
) {
  const query = ConsentRecord.findOne({
    _id:
      voiceProfile.consentRecordId,
    memoryId,
    status: 'approved',
    subjectStatus: 'living',
    relationshipToSubject: 'self',
    processingScope: {
      $in: [
        'external_voice',
        'external_voice_and_avatar',
      ],
    },
    'externalVoiceConsent.provider':
      'elevenlabs',
    'externalVoiceConsent.modelFamily':
      'eleven_v3',
    'externalVoiceConsent.textProcessor':
      'none',
    'externalVoiceConsent.providerVoiceId':
      voiceProfile.providerProfileId,
  })
    .select({
      externalVoiceConsent: 1,
    })
    .lean()

  return query
}

export async function tryGenerateClonedSpeech({
  memoryId,
  text,
}) {
  const voiceProfile =
    await findActiveVoiceProfile(
      memoryId,
    )

  if (!voiceProfile) {
    return null
  }

  if (
    text.length >
    ELEVENLABS_TEXT_MAX_LENGTH
  ) {
    throw createTextTooLongError()
  }

  if (
    !isClonedVoiceProviderConfigured()
  ) {
    throw createProviderNotConfiguredError()
  }

  if (
    typeof voiceProfile
      .providerProfileId !== 'string' ||
    voiceProfile.providerProfileId
      .length === 0
  ) {
    throw createProfileUnavailableError()
  }

  const consent =
    await findMatchingConsent(
      memoryId,
      voiceProfile,
    )

  if (!consent) {
    throw createProfileUnavailableError()
  }

  return generateClonedSpeechAudio({
    text,
    voiceId:
      voiceProfile.providerProfileId,
  })
}
