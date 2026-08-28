import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

export const MAX_MEMORY_ASSET_SIZE_BYTES =
  10 * 1024 * 1024

export const MEMORY_ASSET_MIME_TYPES =
  Object.freeze([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ])

export const MEMORY_ASSET_TYPES =
  Object.freeze([
    'image',
    'document',
  ])

export const MEMORY_ASSET_LIFECYCLE_STATUSES =
  Object.freeze([
    'active',
    'archived',
  ])

export const MEMORY_ASSET_PROCESSING_STATUSES =
  Object.freeze([
    'not_requested',
    'queued',
    'processing',
    'completed',
    'failed',
  ])

export function getMemoryAssetType(
  mimeType,
) {
  return mimeType.startsWith('image/')
    ? 'image'
    : 'document'
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0
}

const technicalMetadataSchema =
  new Schema(
    {
      parserVersion: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80,
      },

      widthPixels: {
        type: Number,
        min: 1,
        max: 100_000,
        default: null,
      },

      heightPixels: {
        type: Number,
        min: 1,
        max: 100_000,
        default: null,
      },

      pageCount: {
        type: Number,
        min: 1,
        max: 100_000,
        default: null,
      },
    },
    {
      _id: false,
    },
  )

const memoryAssetSchema = new Schema(
  {
    memoryId: {
      type: Schema.Types.ObjectId,
      ref: 'MemoryProfile',
      required: true,
    },

    uploadedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      select: false,
    },

    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    originalFileName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 255,
    },

    assetType: {
      type: String,
      enum: MEMORY_ASSET_TYPES,
      required: true,
    },

    mimeType: {
      type: String,
      enum: MEMORY_ASSET_MIME_TYPES,
      required: true,
    },

    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
      max: MAX_MEMORY_ASSET_SIZE_BYTES,
      validate: {
        validator: isPositiveInteger,
        message:
          'Memory asset size must be a positive integer.',
      },
    },

    storageProvider: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    storageKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
      select: false,
    },

    checksumSha256: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-f0-9]{64}$/,
        'Memory asset checksum must be a SHA-256 value.',
      ],
      select: false,
    },

    processingJobId: {
      type: Schema.Types.ObjectId,
      ref: 'ProcessingJob',
      default: null,
      select: false,
    },

    processingStatus: {
      type: String,
      enum:
        MEMORY_ASSET_PROCESSING_STATUSES,
      default: 'not_requested',
    },

    processingProgress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    processingFailureCode: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    technicalMetadata: {
      type: technicalMetadataSchema,
      default: null,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    lifecycleStatus: {
      type: String,
      enum:
        MEMORY_ASSET_LIFECYCLE_STATUSES,
      default: 'active',
    },

    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'memory_assets',
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

        delete safeObject.uploadedByUserId
        delete safeObject.storageKey
        delete safeObject.checksumSha256
        delete safeObject.processingJobId

        return safeObject
      },
    },
  },
)

memoryAssetSchema.index({
  memoryId: 1,
  lifecycleStatus: 1,
  createdAt: -1,
})

memoryAssetSchema.pre(
  'validate',
  function validateAssetType() {
    if (
      this.assetType !==
      getMemoryAssetType(this.mimeType)
    ) {
      this.invalidate(
        'assetType',
        'Memory asset type does not match its MIME type.',
      )
    }
  },
)

memoryAssetSchema.pre(
  'validate',
  function validateLifecycleState() {
    if (
      this.lifecycleStatus === 'archived' &&
      !this.archivedAt
    ) {
      this.invalidate(
        'archivedAt',
        'Archived memory assets require an archive timestamp.',
      )
    }

    if (
      this.lifecycleStatus === 'active' &&
      this.archivedAt
    ) {
      this.invalidate(
        'archivedAt',
        'Active memory assets must not have an archive timestamp.',
      )
    }
  },
)

const MemoryAsset =
  models.MemoryAsset ??
  model('MemoryAsset', memoryAssetSchema)

export default MemoryAsset
