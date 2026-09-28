import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const memoryProfileSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    subjectName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    relationship: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    subjectGender: {
      type: String,
      enum: [
        'female',
        'male',
        'unspecified',
      ],
      default: 'unspecified',
    },

    portraitAssetId: {
      type: Schema.Types.ObjectId,
      ref: 'MemoryAsset',
      default: null,
    },

    voiceSampleRecordingId: {
      type: Schema.Types.ObjectId,
      ref: 'MemoryRecording',
      default: null,
    },

    visibility: {
      type: String,
      enum: ['private', 'shared'],
      default: 'private',
    },

    // One identity for the lifetime of this profile, including archived profiles.
    // Only the compare-and-set initializer writes these immutable fields.
    qrToken: { type: String, match: /^[A-Za-z0-9_-]{32}$/, immutable: true, select: false },
    qrOrigin: { type: String, immutable: true, select: false },
    qrCreatedAt: { type: Date, immutable: true, select: false },
    qrEnabled: { type: Boolean, default: false, select: false },
    publicPublication: {
      type: new Schema({
        enabled: { type: Boolean, default: false },
        profileVersion: { type: String, required: true },
        // Only the bounded public presentation is snapshotted. The archive stays authoritative.
        profileSnapshot: { type: new Schema({
          subjectName: { type: String, required: true, maxlength: 100 },
          description: { type: String, default: '', maxlength: 1000 },
          portraitAssetId: { type: Schema.Types.ObjectId, default: null },
        }, { _id: false }), default: undefined },
        visibilityAtPublish: { type: String, enum: ['private', 'shared'] },
        approvedAt: { type: Date, required: true },
        approvedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        stories: { type: [new Schema({
          sourceId: { type: Schema.Types.ObjectId, required: true },
          version: { type: String, required: true },
          snapshot: { type: new Schema({
            title: { type: String, required: true, maxlength: 160 },
            content: { type: String, required: true, maxlength: 20000 },
            occurredOn: { type: String, default: '' },
          }, { _id: false }), default: undefined },
        }, { _id: false })], default: [] },
        photos: { type: [new Schema({
          sourceId: { type: Schema.Types.ObjectId, required: true },
          version: { type: String, required: true },
          snapshot: { type: new Schema({
            title: { type: String, required: true, maxlength: 120 },
            description: { type: String, default: '', maxlength: 500 },
          }, { _id: false }), default: undefined },
        }, { _id: false })], default: [] },
      }, { _id: false }),
      default: undefined,
      select: false,
    },

    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
  },
  {
    collection: 'memory_profiles',
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_document, returnedObject) {
        const safeObject = {
          ...returnedObject,
        }

        for (const field of ['qrToken', 'qrOrigin', 'qrCreatedAt', 'qrEnabled', 'publicPublication']) {
          delete safeObject[field]
        }

        if (safeObject._id) {
          safeObject.id =
            safeObject._id.toString()

          delete safeObject._id
        }

        for (
          const mediaField of [
            'portraitAssetId',
            'voiceSampleRecordingId',
          ]
        ) {
          if (safeObject[mediaField]) {
            safeObject[mediaField] =
              safeObject[mediaField]
                .toString()
          }
        }

        return safeObject
      },
    },
  },
)

memoryProfileSchema.index({ qrToken: 1 }, {
  name: 'memory_profiles_permanent_qr',
  unique: true,
  partialFilterExpression: { qrToken: { $type: 'string' } },
})

memoryProfileSchema.index(
  {
    ownerId: 1,
    createdAt: -1,
  },
  {
    name: 'memory_profiles_owner_created',
  },
)

memoryProfileSchema.index(
  {
    ownerId: 1,
    status: 1,
  },
  {
    name: 'memory_profiles_owner_status',
  },
)

const MemoryProfile =
  models.MemoryProfile ??
  model('MemoryProfile', memoryProfileSchema)

export default MemoryProfile
