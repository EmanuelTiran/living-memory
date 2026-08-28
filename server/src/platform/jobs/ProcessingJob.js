import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

export const PROCESSING_JOB_TYPES =
  Object.freeze([
    'memory_asset_parse',
    'recording_transcription',
  ])

export const PROCESSING_JOB_STATUSES =
  Object.freeze([
    'queued',
    'processing',
    'completed',
    'failed',
    'cancelled',
  ])

const processingJobSchema = new Schema(
  {
    memoryId: {
      type: Schema.Types.ObjectId,
      ref: 'MemoryProfile',
      required: true,
    },

    jobType: {
      type: String,
      enum: PROCESSING_JOB_TYPES,
      required: true,
    },

    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 220,
    },

    resourceType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    resourceId: {
      type: Schema.Types.ObjectId,
      required: true,
    },

    payload: {
      type: Schema.Types.Mixed,
      required: true,
      select: false,
    },

    status: {
      type: String,
      enum: PROCESSING_JOB_STATUSES,
      default: 'queued',
    },

    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    attemptCount: {
      type: Number,
      min: 0,
      max: 20,
      default: 0,
    },

    maxAttempts: {
      type: Number,
      min: 1,
      max: 10,
      default: 3,
    },

    nextRunAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    workerId: {
      type: String,
      trim: true,
      maxlength: 120,
      default: null,
      select: false,
    },

    leaseExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    lastErrorCode: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    resultSummary: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    collection: 'processing_jobs',
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

        delete safeObject.payload
        delete safeObject.workerId
        delete safeObject.leaseExpiresAt

        return safeObject
      },
    },
  },
)

processingJobSchema.index(
  {
    jobType: 1,
    idempotencyKey: 1,
  },
  {
    unique: true,
  },
)

processingJobSchema.index({
  status: 1,
  nextRunAt: 1,
  createdAt: 1,
})

processingJobSchema.index({
  status: 1,
  leaseExpiresAt: 1,
})

processingJobSchema.index({
  memoryId: 1,
  resourceType: 1,
  resourceId: 1,
  createdAt: -1,
})

const ProcessingJob =
  models.ProcessingJob ??
  model(
    'ProcessingJob',
    processingJobSchema,
  )

export default ProcessingJob
