import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

export const AVATAR_PROFILE_STATUSES =
  Object.freeze([
    'ready',
    'disabled',
    'failed',
  ])

const avatarProfileSchema = new Schema(
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
        'Avatar provider name is invalid.',
      ],
    },

    profileType: {
      type: String,
      enum: [
        'static',
        'stylized',
        'photorealistic',
      ],
      default: 'stylized',
    },

    status: {
      type: String,
      enum: AVATAR_PROFILE_STATUSES,
      default: 'ready',
    },

    providerProfileId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      select: false,
    },

    isPhotorealistic: {
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
        'זהו אווטאר בדיקה מסוגנן. הוא אינו חיקוי פוטוריאליסטי של האדם.',
    },

    disabledAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection:
      'digital_persona_avatar_profiles',
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

avatarProfileSchema.pre(
  'validate',
  function validateAvatarProfileState() {
    if (
      this.provider === 'mock' &&
      this.isPhotorealistic
    ) {
      this.invalidate(
        'isPhotorealistic',
        'Mock avatar profiles cannot be photorealistic.',
      )
    }

    if (
      this.provider === 'd-id' &&
      (
        this.profileType !==
          'stylized' ||
        this.isPhotorealistic
      )
    ) {
      this.invalidate(
        'profileType',
        'The approved D-ID photo avatar must remain a stylized, non-photorealistic likeness.',
      )
    }

    if (
      this.status === 'disabled' &&
      !this.disabledAt
    ) {
      this.invalidate(
        'disabledAt',
        'Disabled avatar profiles require a timestamp.',
      )
    }

    if (
      this.status !== 'disabled' &&
      this.disabledAt
    ) {
      this.invalidate(
        'disabledAt',
        'Only disabled avatar profiles may have a disabled timestamp.',
      )
    }
  },
)

avatarProfileSchema.index(
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
      'digital_persona_one_ready_avatar_per_memory',
  },
)

const AvatarProfile =
  models.AvatarProfile ??
  model(
    'AvatarProfile',
    avatarProfileSchema,
  )

export default AvatarProfile
