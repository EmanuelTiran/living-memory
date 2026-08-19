import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

export const VOICE_PROFILE_STATUSES =
  Object.freeze([
    'ready',
    'disabled',
    'failed',
  ])

const voiceProfileSchema = new Schema(
  {
    memoryId: {
      type: Schema.Types.ObjectId,
      ref: 'MemoryProfile',
      required: true,
    },

    consentRecordId: {
      type: Schema.Types.ObjectId,
      ref: 'ConsentRecord',
      required: true,
      select: false,
    },

    createdByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      select: false,
    },

    provider: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
      match: [
        /^[a-z0-9_-]+$/,
        'Voice provider name is invalid.',
      ],
    },

    profileType: {
      type: String,
      enum: [
        'general',
        'mock',
        'custom',
      ],
      default: 'mock',
    },

    status: {
      type: String,
      enum: VOICE_PROFILE_STATUSES,
      default: 'ready',
    },

    languageCode: {
      type: String,
      trim: true,
      minlength: 2,
      maxlength: 35,
      default: 'he',
      match: [
        /^[a-z]{2,3}(?:-[A-Z]{2})?$/,
        'Voice profile language code is invalid.',
      ],
    },

    providerProfileId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      select: false,
    },

    isRealVoiceClone: {
      type: Boolean,
      default: false,
      immutable: true,
    },

    disclosure: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
      default:
        'זהו פרופיל בדיקה מלאכותי. הוא אינו שיבוט קול ואינו קולו של האדם.',
    },

    disabledAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection:
      'digital_persona_voice_profiles',
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

        delete safeObject.consentRecordId
        delete safeObject.createdByUserId
        delete safeObject.providerProfileId

        return safeObject
      },
    },
  },
)

voiceProfileSchema.pre(
  'validate',
  function validateVoiceProfileState() {
    if (
      this.provider === 'mock' &&
      this.isRealVoiceClone
    ) {
      this.invalidate(
        'isRealVoiceClone',
        'Mock voice profiles cannot represent a real voice clone.',
      )
    }

    if (
      this.provider === 'elevenlabs' &&
      (
        this.profileType !== 'custom' ||
        !this.isRealVoiceClone
      )
    ) {
      this.invalidate(
        'profileType',
        'External voice profiles must represent an explicitly approved custom clone.',
      )
    }

    if (
      this.status === 'disabled' &&
      !this.disabledAt
    ) {
      this.invalidate(
        'disabledAt',
        'Disabled voice profiles require a timestamp.',
      )
    }

    if (
      this.status !== 'disabled' &&
      this.disabledAt
    ) {
      this.invalidate(
        'disabledAt',
        'Only disabled voice profiles may have a disabled timestamp.',
      )
    }
  },
)

voiceProfileSchema.index(
  {
    memoryId: 1,
    status: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      status: 'ready',
    },
    name:
      'digital_persona_one_ready_voice_per_memory',
  },
)

const VoiceProfile =
  models.VoiceProfile ??
  model(
    'VoiceProfile',
    voiceProfileSchema,
  )

export default VoiceProfile
