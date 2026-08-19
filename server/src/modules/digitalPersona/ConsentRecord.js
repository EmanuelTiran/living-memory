import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

export const DIGITAL_PERSONA_CONSENT_POLICY_VERSION =
  'digital-persona-self-consent-v1'

export const EXTERNAL_VOICE_CONSENT_POLICY_VERSION =
  'elevenlabs-v3-existing-clone-v1'

export const EXTERNAL_AVATAR_CONSENT_POLICY_VERSION =
  'did-talks-v2-photo-v1'

export const EXTERNAL_TRANSCRIPTION_CONSENT_POLICY_VERSION =
  'openai-hebrew-chat-transcription-v1'

export const DIGITAL_PERSONA_ALLOWED_USES =
  Object.freeze([
    'voice_synthesis',
    'avatar_animation',
    'ai_conversation',
  ])

export const DIGITAL_PERSONA_CONSENT_STATUSES =
  Object.freeze([
    'approved',
    'revoked',
  ])

function hasRequiredUses(values) {
  return (
    Array.isArray(values) &&
    values.length ===
      DIGITAL_PERSONA_ALLOWED_USES.length &&
    DIGITAL_PERSONA_ALLOWED_USES.every(
      (use) => values.includes(use),
    ) &&
    new Set(values).size === values.length
  )
}

const consentAttestationsSchema =
  new Schema(
    {
      confirmsOwnIdentity: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'The user must confirm that the memory represents them.',
        },
      },

      permitsVoiceUse: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'Explicit voice-use permission is required.',
        },
      },

      permitsLikenessUse: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'Explicit likeness-use permission is required.',
        },
      },

      understandsAiRepresentation: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'AI representation acknowledgement is required.',
        },
      },

      acceptsSafetyRestrictions: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'Safety restrictions must be accepted.',
        },
      },
    },
    {
      _id: false,
    },
  )

const externalVoiceAttestationsSchema =
  new Schema(
    {
      confirmsOwnVoice: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'The user must confirm ownership of the reference voice.',
        },
      },

      confirmsExistingVoiceClone: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'The configured ElevenLabs clone must be confirmed.',
        },
      },

      permitsElevenLabsTextTransfer: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'Explicit ElevenLabs text-transfer permission is required.',
        },
      },

      understandsElevenLabsRetention: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'ElevenLabs processing and retention must be acknowledged.',
        },
      },
    },
    {
      _id: false,
    },
  )

const externalVoiceConsentSchema =
  new Schema(
    {
      provider: {
        type: String,
        enum: ['elevenlabs'],
        required: true,
      },

      modelFamily: {
        type: String,
        enum: ['eleven_v3'],
        required: true,
      },

      textProcessor: {
        type: String,
        enum: ['none'],
        required: true,
      },

      providerVoiceId: {
        type: String,
        required: true,
        trim: true,
        minlength: 10,
        maxlength: 100,
        match: [
          /^[A-Za-z0-9_-]+$/,
          'ElevenLabs voice ID is invalid.',
        ],
      },

      attestations: {
        type:
          externalVoiceAttestationsSchema,
        required: true,
      },

      policyVersion: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
        default:
          EXTERNAL_VOICE_CONSENT_POLICY_VERSION,
      },

      acceptedAt: {
        type: Date,
        required: true,
      },
    },
    {
      _id: false,
    },
  )

const externalAvatarAttestationsSchema =
  new Schema(
    {
      confirmsOwnLikeness: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'The user must confirm that the avatar image represents them.',
        },
      },

      confirmsAuthorizedAvatarImage: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'The user must confirm authorization to use the avatar image.',
        },
      },

      permitsDIDImageTransfer: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'Explicit permission to transfer the avatar image to D-ID is required.',
        },
      },

      permitsDIDAudioTransfer: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'Explicit permission to transfer generated audio to D-ID is required.',
        },
      },

      understandsDIDRetention: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'D-ID processing and temporary retention must be acknowledged.',
        },
      },
    },
    {
      _id: false,
    },
  )

const externalAvatarConsentSchema =
  new Schema(
    {
      provider: {
        type: String,
        enum: ['d-id'],
        required: true,
      },

      modelFamily: {
        type: String,
        enum: ['talks-v2-photo'],
        required: true,
      },

      providerAssetId: {
        type: String,
        required: true,
        trim: true,
        minlength: 5,
        maxlength: 200,
        match: [
          /^[A-Za-z0-9_-]+$/,
          'D-ID avatar asset ID is invalid.',
        ],
      },

      attestations: {
        type:
          externalAvatarAttestationsSchema,
        required: true,
      },

      policyVersion: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
        default:
          EXTERNAL_AVATAR_CONSENT_POLICY_VERSION,
      },

      acceptedAt: {
        type: Date,
        required: true,
      },
    },
    {
      _id: false,
    },
  )

const externalTranscriptionAttestationsSchema =
  new Schema(
    {
      confirmsOwnVoice: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'The user must confirm ownership of the recorded voice.',
        },
      },

      permitsOpenAIAudioTransfer: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'Explicit OpenAI audio-transfer permission is required.',
        },
      },

      understandsOpenAIProcessing: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'OpenAI processing must be acknowledged.',
        },
      },

      understandsAudioNotStored: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'Temporary audio handling must be acknowledged.',
        },
      },

      understandsManualReview: {
        type: Boolean,
        required: true,
        validate: {
          validator(value) {
            return value === true
          },
          message:
            'Manual transcript review must be acknowledged.',
        },
      },
    },
    {
      _id: false,
    },
  )

const externalTranscriptionConsentSchema =
  new Schema(
    {
      provider: {
        type: String,
        enum: ['openai'],
        required: true,
      },

      model: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 100,
      },

      languageCode: {
        type: String,
        enum: ['he'],
        required: true,
      },

      attestations: {
        type:
          externalTranscriptionAttestationsSchema,
        required: true,
      },

      policyVersion: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
        default:
          EXTERNAL_TRANSCRIPTION_CONSENT_POLICY_VERSION,
      },

      acceptedAt: {
        type: Date,
        required: true,
      },
    },
    {
      _id: false,
    },
  )

const consentRecordSchema = new Schema(
  {
    memoryId: {
      type: Schema.Types.ObjectId,
      ref: 'MemoryProfile',
      required: true,
    },

    subjectUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      select: false,
    },

    acceptedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      select: false,
    },

    subjectStatus: {
      type: String,
      enum: ['living'],
      default: 'living',
    },

    relationshipToSubject: {
      type: String,
      enum: ['self'],
      default: 'self',
    },

    consentType: {
      type: String,
      enum: ['voice_and_avatar'],
      default: 'voice_and_avatar',
    },

    allowedUses: {
      type: [
        {
          type: String,
          enum: DIGITAL_PERSONA_ALLOWED_USES,
        },
      ],
      required: true,
      validate: {
        validator: hasRequiredUses,
        message:
          'Digital persona consent must contain the complete approved use set.',
      },
    },

    processingScope: {
      type: String,
      enum: [
        'mock_only',
        'external_voice',
        'external_avatar',
        'external_voice_and_avatar',
      ],
      default: 'mock_only',
    },

    externalVoiceConsent: {
      type: externalVoiceConsentSchema,
      default: null,
    },

    externalAvatarConsent: {
      type: externalAvatarConsentSchema,
      default: null,
    },

    externalTranscriptionConsent: {
      type:
        externalTranscriptionConsentSchema,
      default: null,
    },

    attestations: {
      type: consentAttestationsSchema,
      required: true,
    },

    policyVersion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      default:
        DIGITAL_PERSONA_CONSENT_POLICY_VERSION,
    },

    status: {
      type: String,
      enum:
        DIGITAL_PERSONA_CONSENT_STATUSES,
      default: 'approved',
    },

    acceptedAt: {
      type: Date,
      required: true,
    },

    revokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection:
      'digital_persona_consent_records',
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(
        _document,
        returnedObject,
      ) {
        const safeObject = {
          ...returnedObject,
        }

        if (safeObject._id) {
          safeObject.id =
            safeObject._id.toString()

          delete safeObject._id
        }

        delete safeObject.subjectUserId
        delete safeObject.acceptedByUserId

        if (
          safeObject.externalVoiceConsent
        ) {
          const safeExternalConsent = {
            ...safeObject
              .externalVoiceConsent,
          }

          delete safeExternalConsent
            .providerVoiceId
          delete safeExternalConsent
            .attestations

          safeObject.externalVoiceConsent =
            safeExternalConsent
        }

        if (
          safeObject.externalAvatarConsent
        ) {
          const safeExternalConsent = {
            ...safeObject
              .externalAvatarConsent,
          }

          delete safeExternalConsent
            .providerAssetId
          delete safeExternalConsent
            .attestations

          safeObject.externalAvatarConsent =
            safeExternalConsent
        }

        if (
          safeObject
            .externalTranscriptionConsent
        ) {
          const safeExternalConsent = {
            ...safeObject
              .externalTranscriptionConsent,
          }

          delete safeExternalConsent
            .attestations

          safeObject.externalTranscriptionConsent =
            safeExternalConsent
        }

        return safeObject
      },
    },
  },
)

consentRecordSchema.pre(
  'validate',
  function validateConsentState() {
    if (
      this.subjectUserId?.toString() !==
      this.acceptedByUserId?.toString()
    ) {
      this.invalidate(
        'acceptedByUserId',
        'Self consent must be accepted by the represented user.',
      )
    }

    if (
      this.status === 'approved' &&
      this.revokedAt
    ) {
      this.invalidate(
        'revokedAt',
        'Approved consent cannot have a revocation timestamp.',
      )
    }

    if (
      this.status === 'revoked' &&
      !this.revokedAt
    ) {
      this.invalidate(
        'revokedAt',
        'Revoked consent requires a revocation timestamp.',
      )
    }

    const usesExternalVoice = [
      'external_voice',
      'external_voice_and_avatar',
    ].includes(this.processingScope)

    const usesExternalAvatar = [
      'external_avatar',
      'external_voice_and_avatar',
    ].includes(this.processingScope)

    if (
      usesExternalVoice &&
      !this.externalVoiceConsent
    ) {
      this.invalidate(
        'externalVoiceConsent',
        'External voice processing requires provider-specific consent.',
      )
    }

    if (
      !usesExternalVoice &&
      this.externalVoiceConsent
    ) {
      this.invalidate(
        'processingScope',
        'The selected processing scope cannot include external voice consent.',
      )
    }

    if (
      usesExternalAvatar &&
      !this.externalAvatarConsent
    ) {
      this.invalidate(
        'externalAvatarConsent',
        'External avatar processing requires provider-specific consent.',
      )
    }

    if (
      !usesExternalAvatar &&
      this.externalAvatarConsent
    ) {
      this.invalidate(
        'processingScope',
        'The selected processing scope cannot include external avatar consent.',
      )
    }
  },
)

consentRecordSchema.index(
  {
    memoryId: 1,
    status: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      status: 'approved',
    },
    name:
      'digital_persona_one_approved_consent_per_memory',
  },
)

consentRecordSchema.index(
  {
    memoryId: 1,
    acceptedAt: -1,
  },
  {
    name:
      'digital_persona_consent_memory_accepted',
  },
)

const ConsentRecord =
  models.ConsentRecord ??
  model(
    'ConsentRecord',
    consentRecordSchema,
  )

export default ConsentRecord
