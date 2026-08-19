import { env } from '../../config/env.js'
import { AppError } from '../../errors/AppError.js'
import {
  MEMORY_PERMISSIONS,
  requireMemoryPermission,
} from '../memories/memoryAccessService.js'
import {
  ELEVENLABS_TEXT_MAX_LENGTH,
} from '../voice/elevenLabsSpeechProvider.js'
import AvatarProfile from './AvatarProfile.js'
import ConsentRecord, {
  DIGITAL_PERSONA_ALLOWED_USES,
  DIGITAL_PERSONA_CONSENT_POLICY_VERSION,
  EXTERNAL_AVATAR_CONSENT_POLICY_VERSION,
  EXTERNAL_TRANSCRIPTION_CONSENT_POLICY_VERSION,
  EXTERNAL_VOICE_CONSENT_POLICY_VERSION,
} from './ConsentRecord.js'
import {
  clearDIDAvatarJobsForMemory,
} from './didAvatarJobStore.js'
import VoiceProfile from './VoiceProfile.js'
import {
  activateChatVoiceInputSchema,
  activateDIDAvatarSchema,
  activateVoiceCloneSchema,
  digitalPersonaParamsSchema,
  selfConsentSchema,
} from './digitalPersonaValidation.js'
import {
  mockAvatarProvider,
} from './providers/mockAvatarProvider.js'
import {
  mockVoiceProvider,
} from './providers/mockVoiceProvider.js'
import {
  elevenLabsVoiceProvider,
} from './providers/elevenLabsVoiceProvider.js'
import {
  DID_AVATAR_ASSET_ID,
  didAvatarProfileProvider,
} from './providers/didAvatarProfileProvider.js'
import {
  isDIDAvatarProviderConfigured,
  isDIDRealtimeAvatarConfigured,
} from './providers/didAvatarProvider.js'

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

function validateMemoryId(memoryId) {
  return digitalPersonaParamsSchema
    .parse({
      memoryId,
    })
    .memoryId
}

function normalizeName(value) {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('he-IL')
}

function createSubjectMismatchError() {
  return new AppError(
    'The confirmed name does not match the memory subject.',
    {
      statusCode: 400,
      code:
        'SELF_CONSENT_SUBJECT_MISMATCH',
    },
  )
}

function createConsentRequiredError() {
  return new AppError(
    'Approved self consent is required before creating digital persona profiles.',
    {
      statusCode: 409,
      code:
        'DIGITAL_PERSONA_CONSENT_REQUIRED',
    },
  )
}

function createVoiceProviderNotConfiguredError() {
  return new AppError(
    'The cloned voice provider is not configured.',
    {
      statusCode: 503,
      code:
        'VOICE_CLONE_NOT_CONFIGURED',
    },
  )
}

function createDIDProviderNotConfiguredError() {
  return new AppError(
    'The D-ID avatar provider is not configured.',
    {
      statusCode: 503,
      code: 'DID_NOT_CONFIGURED',
    },
  )
}

function createChatVoiceInputNotConfiguredError() {
  return new AppError(
    'OpenAI chat transcription is not configured.',
    {
      statusCode: 503,
      code:
        'CHAT_VOICE_INPUT_NOT_CONFIGURED',
    },
  )
}

function createVoiceCloneRequiredForAvatarError() {
  return new AppError(
    'The approved ElevenLabs voice clone must be active before D-ID can be enabled.',
    {
      statusCode: 409,
      code:
        'DID_VOICE_CLONE_REQUIRED',
    },
  )
}

function toPublicObject(document) {
  if (!document) {
    return null
  }

  return typeof document.toJSON ===
    'function'
    ? document.toJSON()
    : document
}

async function requireSelfManagedMemory(
  userId,
  memoryId,
) {
  return requireMemoryPermission(
    userId,
    memoryId,
    MEMORY_PERMISSIONS.MANAGE,
  )
}

async function findApprovedConsent(
  memoryId,
) {
  return ConsentRecord.findOne({
    memoryId,
    status: 'approved',
    subjectStatus: 'living',
    relationshipToSubject: 'self',
  })
}

async function loadSetupDocuments(memoryId) {
  return Promise.all([
    findApprovedConsent(memoryId),
    VoiceProfile.findOne({
      memoryId,
      status: 'ready',
    }),
    AvatarProfile.findOne({
      memoryId,
      status: 'ready',
    }),
  ])
}

function createPublicSetup({
  memoryProfile,
  consent,
  voiceProfile,
  avatarProfile,
}) {
  const publicVoiceProfile =
    toPublicObject(voiceProfile)

  const publicAvatarProfile =
    toPublicObject(avatarProfile)

  const voiceCloneIsActive =
    publicVoiceProfile?.provider ===
      'elevenlabs' &&
    publicVoiceProfile?.status ===
      'ready' &&
    publicVoiceProfile
      ?.isRealVoiceClone === true

  const didAvatarIsActive =
    publicAvatarProfile?.provider ===
      'd-id' &&
    publicAvatarProfile?.status ===
      'ready' &&
    publicAvatarProfile
      ?.isPhotorealistic === false

  const localAvatarIsAvailable =
    Boolean(consent) &&
    publicAvatarProfile?.status ===
      'ready'

  const didRealtimeAvatarIsAvailable =
    didAvatarIsActive &&
    isDIDRealtimeAvatarConfigured()

  const chatVoiceInputIsActive =
    consent?.externalTranscriptionConsent
      ?.provider === 'openai' &&
    consent.externalTranscriptionConsent
      .model ===
      env.openaiTranscriptionModel &&
    consent.externalTranscriptionConsent
      .languageCode === 'he'

  return {
    subject: {
      status: 'living',
      relationship: 'self',
      name: memoryProfile.subjectName,
    },
    providerMode:
      voiceCloneIsActive
        ? 'elevenlabs'
        : 'mock',
    externalMediaTransferAllowed:
      Boolean(consent) &&
      (consent.processingScope !==
        'mock_only' ||
        Boolean(
          consent
            .externalTranscriptionConsent,
        )),
    consent:
      toPublicObject(consent),
    voiceProfile:
      publicVoiceProfile,
    avatarProfile:
      publicAvatarProfile,
    voiceClone: {
      provider: 'elevenlabs',
      textProcessor: 'none',
      providerConfigured:
        Boolean(
          env.elevenLabsApiKey &&
            env.elevenLabsVoiceId &&
            env.elevenLabsModelId ===
              'eleven_v3',
        ),
      active: voiceCloneIsActive,
      maxSpeechCharacters:
        ELEVENLABS_TEXT_MAX_LENGTH,
    },
    avatar: {
      provider: 'd-id',
      providerConfigured:
        isDIDAvatarProviderConfigured(),
      active: didAvatarIsActive,
      localFallbackAvailable:
        localAvatarIsAvailable,
      localAssetUrl:
        localAvatarIsAvailable
          ? '/assets/emanuel-living-memory-avatar.png'
          : null,
      resultDelivery:
        'server_private_stream',
      remoteResourcesTemporary: true,
      realtime: {
        available:
          didRealtimeAvatarIsAvailable,
        transport: 'webrtc',
        agentId:
          didRealtimeAvatarIsAvailable
            ? env.didAgentId
            : null,
        clientKey:
          didRealtimeAvatarIsAvailable
            ? env.didClientKey
            : null,
        usesApprovedAudioOnly: true,
        llmDisabled: true,
      },
    },
    chatVoiceInput: {
      provider: 'openai',
      providerConfigured:
        Boolean(
          env.openaiApiKey &&
            env.openaiTranscriptionModel,
        ),
      active: chatVoiceInputIsActive,
      languageCode: 'he',
      maxDurationSeconds: 60,
      maxFileSizeBytes:
        10 * 1024 * 1024,
      audioStored: false,
      autoSend: false,
    },
  }
}

async function loadPublicSetup(
  memoryProfile,
  memoryId,
) {
  const [
    consent,
    voiceProfile,
    avatarProfile,
  ] = await loadSetupDocuments(memoryId)

  return createPublicSetup({
    memoryProfile,
    consent,
    voiceProfile,
    avatarProfile,
  })
}

function isDuplicateKeyError(error) {
  return error?.code === 11000
}

async function createMockVoiceProfile({
  userId,
  memoryId,
  consent,
}) {
  const existingProfile =
    await VoiceProfile.findOne({
      memoryId,
      status: 'ready',
    })

  if (existingProfile) {
    return existingProfile
  }

  const providerResult =
    await mockVoiceProvider.createProfile({
      memoryId,
    })

  try {
    return await VoiceProfile.create({
      memoryId,
      consentRecordId: consent._id,
      createdByUserId: userId,
      provider:
        mockVoiceProvider.name,
      ...providerResult,
    })
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error
    }

    return VoiceProfile.findOne({
      memoryId,
      status: 'ready',
    })
  }
}

async function createMockAvatarProfile({
  userId,
  memoryId,
  consent,
}) {
  const existingProfile =
    await AvatarProfile.findOne({
      memoryId,
      status: 'ready',
    })

  if (existingProfile) {
    return existingProfile
  }

  const providerResult =
    await mockAvatarProvider.createProfile({
      memoryId,
    })

  try {
    return await AvatarProfile.create({
      memoryId,
      consentRecordId: consent._id,
      createdByUserId: userId,
      provider:
        mockAvatarProvider.name,
      ...providerResult,
    })
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error
    }

    return AvatarProfile.findOne({
      memoryId,
      status: 'ready',
    })
  }
}

async function createExternalVoiceProfile({
  userId,
  memoryId,
  consent,
}) {
  const disabledAt = new Date()

  await VoiceProfile.updateMany(
    {
      memoryId,
      status: 'ready',
    },
    {
      $set: {
        status: 'disabled',
        disabledAt,
      },
    },
  )

  const providerResult =
    await elevenLabsVoiceProvider
      .createProfile({
        voiceId:
          env.elevenLabsVoiceId,
      })

  try {
    return await VoiceProfile.create({
      memoryId,
      consentRecordId: consent._id,
      createdByUserId: userId,
      provider:
        elevenLabsVoiceProvider.name,
      ...providerResult,
    })
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error
    }

    return VoiceProfile.findOne({
      memoryId,
      status: 'ready',
    })
  }
}

async function createExternalAvatarProfile({
  userId,
  memoryId,
  consent,
}) {
  const disabledAt = new Date()

  await AvatarProfile.updateMany(
    {
      memoryId,
      status: 'ready',
    },
    {
      $set: {
        status: 'disabled',
        disabledAt,
      },
    },
  )

  const providerResult =
    await didAvatarProfileProvider
      .createProfile({
        assetId:
          DID_AVATAR_ASSET_ID,
      })

  try {
    return await AvatarProfile.create({
      memoryId,
      consentRecordId: consent._id,
      createdByUserId: userId,
      provider:
        didAvatarProfileProvider.name,
      ...providerResult,
    })
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error
    }

    return AvatarProfile.findOne({
      memoryId,
      status: 'ready',
    })
  }
}

export async function getDigitalPersonaSetup(
  userId,
  memoryId,
) {
  validateUserId(userId)

  const validatedMemoryId =
    validateMemoryId(memoryId)

  const { memoryProfile } =
    await requireSelfManagedMemory(
      userId,
      validatedMemoryId,
    )

  return loadPublicSetup(
    memoryProfile,
    validatedMemoryId,
  )
}

export async function acceptSelfConsent(
  userId,
  memoryId,
  input,
) {
  validateUserId(userId)

  const validatedMemoryId =
    validateMemoryId(memoryId)

  const consentInput =
    selfConsentSchema.parse(input)

  const { memoryProfile } =
    await requireSelfManagedMemory(
      userId,
      validatedMemoryId,
    )

  if (
    normalizeName(
      consentInput
        .subjectNameConfirmation,
    ) !==
    normalizeName(
      memoryProfile.subjectName,
    )
  ) {
    throw createSubjectMismatchError()
  }

  const existingConsent =
    await findApprovedConsent(
      validatedMemoryId,
    )

  if (!existingConsent) {
    try {
      await ConsentRecord.create({
        memoryId: validatedMemoryId,
        subjectUserId: userId,
        acceptedByUserId: userId,
        allowedUses: [
          ...DIGITAL_PERSONA_ALLOWED_USES,
        ],
        attestations: {
          confirmsOwnIdentity:
            consentInput
              .confirmsOwnIdentity,
          permitsVoiceUse:
            consentInput
              .permitsVoiceUse,
          permitsLikenessUse:
            consentInput
              .permitsLikenessUse,
          understandsAiRepresentation:
            consentInput
              .understandsAiRepresentation,
          acceptsSafetyRestrictions:
            consentInput
              .acceptsSafetyRestrictions,
        },
        policyVersion:
          DIGITAL_PERSONA_CONSENT_POLICY_VERSION,
        acceptedAt: new Date(),
      })
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error
      }
    }
  }

  return loadPublicSetup(
    memoryProfile,
    validatedMemoryId,
  )
}

export async function initializeMockProfiles(
  userId,
  memoryId,
) {
  validateUserId(userId)

  const validatedMemoryId =
    validateMemoryId(memoryId)

  const { memoryProfile } =
    await requireSelfManagedMemory(
      userId,
      validatedMemoryId,
    )

  const consent =
    await findApprovedConsent(
      validatedMemoryId,
    )

  if (!consent) {
    throw createConsentRequiredError()
  }

  await Promise.all([
    createMockVoiceProfile({
      userId,
      memoryId: validatedMemoryId,
      consent,
    }),
    createMockAvatarProfile({
      userId,
      memoryId: validatedMemoryId,
      consent,
    }),
  ])

  return loadPublicSetup(
    memoryProfile,
    validatedMemoryId,
  )
}

export async function activateVoiceClone(
  userId,
  memoryId,
  input,
) {
  validateUserId(userId)

  const validatedMemoryId =
    validateMemoryId(memoryId)

  const voiceConsent =
    activateVoiceCloneSchema.parse(
      input,
    )

  const { memoryProfile } =
    await requireSelfManagedMemory(
      userId,
      validatedMemoryId,
    )

  if (
    !env.elevenLabsApiKey ||
    !env.elevenLabsVoiceId ||
    env.elevenLabsModelId !==
      'eleven_v3'
  ) {
    throw createVoiceProviderNotConfiguredError()
  }

  const consent =
    await findApprovedConsent(
      validatedMemoryId,
    )

  if (!consent) {
    throw createConsentRequiredError()
  }

  const acceptedAt = new Date()

  const updateResult =
    await ConsentRecord.updateOne(
      {
        _id: consent._id,
        status: 'approved',
      },
      {
        $set: {
          processingScope:
            consent.externalAvatarConsent
              ? 'external_voice_and_avatar'
              : 'external_voice',
          externalVoiceConsent: {
            provider: 'elevenlabs',
            modelFamily:
              'eleven_v3',
            textProcessor: 'none',
            providerVoiceId:
              env.elevenLabsVoiceId,
            attestations: {
              confirmsOwnVoice:
                voiceConsent
                  .confirmsOwnVoice,
              confirmsExistingVoiceClone:
                voiceConsent
                  .confirmsExistingVoiceClone,
              permitsElevenLabsTextTransfer:
                voiceConsent
                  .permitsElevenLabsTextTransfer,
              understandsElevenLabsRetention:
                voiceConsent
                  .understandsElevenLabsRetention,
            },
            policyVersion:
              EXTERNAL_VOICE_CONSENT_POLICY_VERSION,
            acceptedAt,
          },
        },
      },
      {
        runValidators: true,
      },
    )

  if (
    updateResult?.matchedCount === 0
  ) {
    throw createConsentRequiredError()
  }

  await createExternalVoiceProfile({
    userId,
    memoryId: validatedMemoryId,
    consent,
  })

  return loadPublicSetup(
    memoryProfile,
    validatedMemoryId,
  )
}

export async function activateChatVoiceInput(
  userId,
  memoryId,
  input,
) {
  validateUserId(userId)

  const validatedMemoryId =
    validateMemoryId(memoryId)

  const voiceInputConsent =
    activateChatVoiceInputSchema.parse(
      input,
    )

  const { memoryProfile } =
    await requireSelfManagedMemory(
      userId,
      validatedMemoryId,
    )

  if (
    !env.openaiApiKey ||
    !env.openaiTranscriptionModel
  ) {
    throw createChatVoiceInputNotConfiguredError()
  }

  const consent =
    await findApprovedConsent(
      validatedMemoryId,
    )

  if (!consent) {
    throw createConsentRequiredError()
  }

  const acceptedAt = new Date()

  const updateResult =
    await ConsentRecord.updateOne(
      {
        _id: consent._id,
        status: 'approved',
      },
      {
        $set: {
          externalTranscriptionConsent: {
            provider: 'openai',
            model:
              env.openaiTranscriptionModel,
            languageCode: 'he',
            attestations: {
              confirmsOwnVoice:
                voiceInputConsent
                  .confirmsOwnVoice,
              permitsOpenAIAudioTransfer:
                voiceInputConsent
                  .permitsOpenAIAudioTransfer,
              understandsOpenAIProcessing:
                voiceInputConsent
                  .understandsOpenAIProcessing,
              understandsAudioNotStored:
                voiceInputConsent
                  .understandsAudioNotStored,
              understandsManualReview:
                voiceInputConsent
                  .understandsManualReview,
            },
            policyVersion:
              EXTERNAL_TRANSCRIPTION_CONSENT_POLICY_VERSION,
            acceptedAt,
          },
        },
      },
      {
        runValidators: true,
      },
    )

  if (
    updateResult?.matchedCount === 0
  ) {
    throw createConsentRequiredError()
  }

  return loadPublicSetup(
    memoryProfile,
    validatedMemoryId,
  )
}

export async function activateDIDAvatar(
  userId,
  memoryId,
  input,
) {
  validateUserId(userId)

  const validatedMemoryId =
    validateMemoryId(memoryId)

  const avatarConsent =
    activateDIDAvatarSchema.parse(
      input,
    )

  const { memoryProfile } =
    await requireSelfManagedMemory(
      userId,
      validatedMemoryId,
    )

  if (
    !isDIDAvatarProviderConfigured()
  ) {
    throw createDIDProviderNotConfiguredError()
  }

  const consent =
    await findApprovedConsent(
      validatedMemoryId,
    )

  if (!consent) {
    throw createConsentRequiredError()
  }

  const activeVoiceClone =
    await VoiceProfile.findOne({
      memoryId: validatedMemoryId,
      provider: 'elevenlabs',
      profileType: 'custom',
      status: 'ready',
      isRealVoiceClone: true,
    })

  if (!activeVoiceClone) {
    throw createVoiceCloneRequiredForAvatarError()
  }

  const acceptedAt = new Date()

  const updateResult =
    await ConsentRecord.updateOne(
      {
        _id: consent._id,
        status: 'approved',
      },
      {
        $set: {
          processingScope:
            consent.externalVoiceConsent
              ? 'external_voice_and_avatar'
              : 'external_avatar',
          externalAvatarConsent: {
            provider: 'd-id',
            modelFamily:
              'talks-v2-photo',
            providerAssetId:
              DID_AVATAR_ASSET_ID,
            attestations: {
              confirmsOwnLikeness:
                avatarConsent
                  .confirmsOwnLikeness,
              confirmsAuthorizedAvatarImage:
                avatarConsent
                  .confirmsAuthorizedAvatarImage,
              permitsDIDImageTransfer:
                avatarConsent
                  .permitsDIDImageTransfer,
              permitsDIDAudioTransfer:
                avatarConsent
                  .permitsDIDAudioTransfer,
              understandsDIDRetention:
                avatarConsent
                  .understandsDIDRetention,
            },
            policyVersion:
              EXTERNAL_AVATAR_CONSENT_POLICY_VERSION,
            acceptedAt,
          },
        },
      },
      {
        runValidators: true,
      },
    )

  if (
    updateResult?.matchedCount === 0
  ) {
    throw createConsentRequiredError()
  }

  await createExternalAvatarProfile({
    userId,
    memoryId: validatedMemoryId,
    consent,
  })

  return loadPublicSetup(
    memoryProfile,
    validatedMemoryId,
  )
}

export async function revokeSelfConsent(
  userId,
  memoryId,
) {
  validateUserId(userId)

  const validatedMemoryId =
    validateMemoryId(memoryId)

  const { memoryProfile } =
    await requireSelfManagedMemory(
      userId,
      validatedMemoryId,
    )

  const consent =
    await findApprovedConsent(
      validatedMemoryId,
    )

  if (!consent) {
    return loadPublicSetup(
      memoryProfile,
      validatedMemoryId,
    )
  }

  const disabledAt = new Date()

  await Promise.all([
    ConsentRecord.updateOne(
      {
        _id: consent._id,
        status: 'approved',
      },
      {
        $set: {
          status: 'revoked',
          revokedAt: disabledAt,
        },
      },
    ),
    VoiceProfile.updateMany(
      {
        memoryId: validatedMemoryId,
        status: 'ready',
      },
      {
        $set: {
          status: 'disabled',
          disabledAt,
        },
      },
    ),
    AvatarProfile.updateMany(
      {
        memoryId: validatedMemoryId,
        status: 'ready',
      },
      {
        $set: {
          status: 'disabled',
          disabledAt,
        },
      },
    ),
  ])

  clearDIDAvatarJobsForMemory(
    validatedMemoryId,
  )

  return loadPublicSetup(
    memoryProfile,
    validatedMemoryId,
  )
}
