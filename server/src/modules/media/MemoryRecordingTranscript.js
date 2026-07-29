import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

export const RECORDING_TRANSCRIPT_REVIEW_STATUSES =
  Object.freeze([
    'draft',
    'approved',
  ])

export const RECORDING_TRANSCRIPT_LIFECYCLE_STATUSES =
  Object.freeze([
    'active',
    'archived',
  ])

export const RECORDING_TRANSCRIPT_MAX_LENGTH =
  500_000

function isPositiveInteger(value) {
  return (
    Number.isInteger(value) &&
    value > 0
  )
}

const memoryRecordingTranscriptSchema =
  new Schema(
    {
      memoryId: {
        type: Schema.Types.ObjectId,
        ref: 'MemoryProfile',
        required: true,
        immutable: true,
      },

      recordingId: {
        type: Schema.Types.ObjectId,
        ref: 'MemoryRecording',
        required: true,
        immutable: true,
      },

      requestedByUserId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        immutable: true,
      },

      content: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength:
          RECORDING_TRANSCRIPT_MAX_LENGTH,
      },

      languageCode: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 35,
        match: [
          /^[a-z]{2,3}(?:-[A-Z]{2})?$/,
          'Transcript language code is invalid.',
        ],
      },

      transcriptionProvider: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 50,
      },

      transcriptionModel: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 100,
      },

      providerResponseId: {
        type: String,
        trim: true,
        maxlength: 200,
        default: '',
        select: false,
      },

      recordingChecksumSha256: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        match: [
          /^[a-f0-9]{64}$/,
          'Recording checksum must be a SHA-256 value.',
        ],
        immutable: true,
        select: false,
      },

      generatedAt: {
        type: Date,
        required: true,
        default: Date.now,
        immutable: true,
      },

      reviewStatus: {
        type: String,
        enum:
          RECORDING_TRANSCRIPT_REVIEW_STATUSES,
        default: 'draft',
      },

      approvedAt: {
        type: Date,
        default: null,
      },

      approvedByUserId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },

      revision: {
        type: Number,
        min: 1,
        default: 1,
        validate: {
          validator: isPositiveInteger,
          message:
            'Transcript revision must be a positive integer.',
        },
      },

      lifecycleStatus: {
        type: String,
        enum:
          RECORDING_TRANSCRIPT_LIFECYCLE_STATUSES,
        default: 'active',
      },

      archivedAt: {
        type: Date,
        default: null,
      },

      archivedByUserId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
    },
    {
      collection:
        'memory_recording_transcripts',
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

          delete safeObject
            .providerResponseId

          delete safeObject
            .recordingChecksumSha256

          return safeObject
        },
      },
    },
  )

memoryRecordingTranscriptSchema.pre(
  'validate',
  function validateReviewState() {
    if (
      this.reviewStatus ===
      'approved'
    ) {
      if (!this.approvedAt) {
        this.invalidate(
          'approvedAt',
          'Approved transcripts require an approval timestamp.',
        )
      }

      if (!this.approvedByUserId) {
        this.invalidate(
          'approvedByUserId',
          'Approved transcripts require an approving user.',
        )
      }
    }

    if (
      this.reviewStatus ===
      'draft'
    ) {
      if (this.approvedAt) {
        this.invalidate(
          'approvedAt',
          'Draft transcripts cannot have an approval timestamp.',
        )
      }

      if (this.approvedByUserId) {
        this.invalidate(
          'approvedByUserId',
          'Draft transcripts cannot have an approving user.',
        )
      }
    }
  },
)

memoryRecordingTranscriptSchema.pre(
  'validate',
  function validateLifecycleState() {
    if (
      this.lifecycleStatus ===
      'archived'
    ) {
      if (!this.archivedAt) {
        this.invalidate(
          'archivedAt',
          'Archived transcripts require an archive timestamp.',
        )
      }

      if (!this.archivedByUserId) {
        this.invalidate(
          'archivedByUserId',
          'Archived transcripts require an archiving user.',
        )
      }
    }

    if (
      this.lifecycleStatus ===
      'active'
    ) {
      if (this.archivedAt) {
        this.invalidate(
          'archivedAt',
          'Active transcripts cannot have an archive timestamp.',
        )
      }

      if (this.archivedByUserId) {
        this.invalidate(
          'archivedByUserId',
          'Active transcripts cannot have an archiving user.',
        )
      }
    }
  },
)

memoryRecordingTranscriptSchema.index(
  {
    recordingId: 1,
  },
  {
    name:
      'memory_recording_transcripts_unique_recording',
    unique: true,
  },
)

memoryRecordingTranscriptSchema.index(
  {
    memoryId: 1,
    reviewStatus: 1,
    lifecycleStatus: 1,
    updatedAt: -1,
  },
  {
    name:
      'memory_recording_transcripts_memory_review_updated',
  },
)

memoryRecordingTranscriptSchema.index(
  {
    requestedByUserId: 1,
    createdAt: -1,
  },
  {
    name:
      'memory_recording_transcripts_requester_created',
  },
)

const MemoryRecordingTranscript =
  models.MemoryRecordingTranscript ??
  model(
    'MemoryRecordingTranscript',
    memoryRecordingTranscriptSchema,
  )

export default MemoryRecordingTranscript