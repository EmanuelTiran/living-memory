import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

export const MAX_RECORDING_SIZE_BYTES =
  25 * 1024 * 1024

export const MAX_RECORDING_DURATION_MS =
  6 * 60 * 60 * 1000

export const RECORDING_MIME_TYPES =
  Object.freeze([
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/wav',
    'audio/x-wav',
    'audio/webm',
  ])

export const RECORDING_CONSENT_BASES =
  Object.freeze([
    'self',
    'subject_consent',
    'authorized_representative',
    'rights_holder',
  ])

export const RECORDING_ALLOWED_USES =
  Object.freeze([
    'transcription',
    'memory_grounding',
    'recording_playback',
    'voice_imitation',
  ])

export const RECORDING_STORAGE_STATUSES =
  Object.freeze([
    'pending',
    'stored',
    'failed',
  ])

export const RECORDING_TRANSCRIPTION_STATUSES =
  Object.freeze([
    'not_requested',
    'queued',
    'processing',
    'completed',
    'failed',
  ])

export const RECORDING_LIFECYCLE_STATUSES =
  Object.freeze([
    'active',
    'archived',
  ])

export const RECORDING_CONSENT_VERSION =
  'recording-consent-v1'

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0
}

function hasUniqueValues(values) {
  return (
    Array.isArray(values) &&
    new Set(values).size === values.length
  )
}

const recordingConsentSchema = new Schema(
  {
    basis: {
      type: String,
      enum: RECORDING_CONSENT_BASES,
      required: true,
    },

    permittedUses: {
      type: [
        {
          type: String,
          enum: RECORDING_ALLOWED_USES,
        },
      ],
      required: true,
      validate: [
        {
          validator(value) {
            return (
              Array.isArray(value) &&
              value.length > 0
            )
          },
          message:
            'Recording consent requires at least one permitted use.',
        },
        {
          validator: hasUniqueValues,
          message:
            'Recording consent uses must be unique.',
        },
      ],
    },

    confirmedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    confirmedAt: {
      type: Date,
      required: true,
    },

    statementVersion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      default:
        RECORDING_CONSENT_VERSION,
    },
  },
  {
    _id: false,
  },
)

const interviewContextSchema = new Schema(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true,
      immutable: true,
    },

    promptKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      immutable: true,
    },

    promptCategory: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      immutable: true,
    },

    promptText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
      immutable: true,
    },
  },
  {
    _id: false,
  },
)

const familyQuestionContextSchema =
  new Schema(
    {
      questionId: {
        type: Schema.Types.ObjectId,
        ref: 'FamilyQuestion',
        required: true,
        immutable: true,
      },

      questionText: {
        type: String,
        required: true,
        trim: true,
        minlength: 5,
        maxlength: 500,
        immutable: true,
      },
    },
    {
      _id: false,
    },
  )

const memoryRecordingSchema = new Schema(
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
    },

    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },

    originalFileName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 255,
    },

    mimeType: {
      type: String,
      enum: RECORDING_MIME_TYPES,
      required: true,
    },

    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
      max: MAX_RECORDING_SIZE_BYTES,
      validate: {
        validator: isPositiveInteger,
        message:
          'Recording size must be a positive integer.',
      },
    },

    durationMs: {
      type: Number,
      min: 1,
      max: MAX_RECORDING_DURATION_MS,
      default: null,
      validate: {
        validator(value) {
          return (
            value === null ||
            isPositiveInteger(value)
          )
        },
        message:
          'Recording duration must be a positive integer.',
      },
    },

    languageCode: {
      type: String,
      trim: true,
      minlength: 2,
      maxlength: 35,
      default: 'he',
      match: [
        /^[a-z]{2,3}(?:-[A-Z]{2})?$/,
        'Recording language code is invalid.',
      ],
    },

    consent: {
      type: recordingConsentSchema,
      required: true,
    },

    interviewContext: {
      type: interviewContextSchema,
      default: null,
    },

    familyQuestionContext: {
      type:
        familyQuestionContextSchema,
      default: null,
    },

    storageStatus: {
      type: String,
      enum:
        RECORDING_STORAGE_STATUSES,
      default: 'pending',
    },

    storageProvider: {
      type: String,
      trim: true,
      maxlength: 50,
      default: '',
    },

    storageKey: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
      select: false,
    },

    checksumSha256: {
      type: String,
      trim: true,
      lowercase: true,
      match: [
        /^$|^[a-f0-9]{64}$/,
        'Recording checksum must be a SHA-256 value.',
      ],
      default: '',
      select: false,
    },

    storageFailureCode: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
      select: false,
    },

    transcriptionStatus: {
      type: String,
      enum:
        RECORDING_TRANSCRIPTION_STATUSES,
      default: 'not_requested',
    },

    transcriptionProgress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    transcriptionJobId: {
      type: Schema.Types.ObjectId,
      ref: 'ProcessingJob',
      default: null,
      select: false,
    },

    transcriptionRequestSequence: {
      type: Number,
      min: 0,
      default: 0,
      select: false,
    },

    transcriptionProvider: {
      type: String,
      trim: true,
      maxlength: 50,
      default: '',
    },

    transcriptionModel: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    transcriptionCompletedAt: {
      type: Date,
      default: null,
    },

    transcriptionFailureCode: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
      select: false,
    },

    lifecycleStatus: {
      type: String,
      enum:
        RECORDING_LIFECYCLE_STATUSES,
      default: 'active',
    },

    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'memory_recordings',
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

        delete safeObject.storageKey
        delete safeObject.checksumSha256
        delete safeObject.storageFailureCode
        delete safeObject
          .transcriptionFailureCode
        delete safeObject
          .transcriptionJobId
        delete safeObject
          .transcriptionRequestSequence

        if (safeObject.consent) {
          const safeConsent = {
            ...safeObject.consent,
          }

          delete safeConsent
            .confirmedByUserId

          safeObject.consent =
            safeConsent
        }

        return safeObject
      },
    },
  },
)

memoryRecordingSchema.pre(
  'validate',
  function validatePromptContext() {
    if (
      this.interviewContext &&
      this.familyQuestionContext
    ) {
      this.invalidate(
        'familyQuestionContext',
        'A recording cannot answer two prompt sources.',
      )
    }
  },
)

memoryRecordingSchema.pre(
  'validate',
  function validateStorageState() {
    const hasStorageProvider =
      this.storageProvider.length > 0

    const hasStorageKey =
      this.storageKey.length > 0

    if (
      hasStorageProvider !== hasStorageKey
    ) {
      this.invalidate(
        hasStorageProvider
          ? 'storageKey'
          : 'storageProvider',
        'Recording storage provider and key must be configured together.',
      )
    }

    if (
      this.storageStatus === 'stored' &&
      (!hasStorageProvider ||
        !hasStorageKey)
    ) {
      this.invalidate(
        'storageStatus',
        'Stored recordings require storage metadata.',
      )
    }

    if (
      this.storageStatus === 'failed' &&
      this.storageFailureCode.length === 0
    ) {
      this.invalidate(
        'storageFailureCode',
        'Failed recording storage requires a failure code.',
      )
    }

    if (
      this.storageStatus !== 'failed' &&
      this.storageFailureCode.length > 0
    ) {
      this.invalidate(
        'storageFailureCode',
        'A storage failure code is only allowed for failed storage.',
      )
    }
  },
)

memoryRecordingSchema.pre(
  'validate',
  function validateVoiceImitationConsent() {
    const permitsVoiceImitation =
      this.consent?.permittedUses
        ?.includes('voice_imitation')

    if (
      permitsVoiceImitation &&
      this.consent?.basis !== 'self'
    ) {
      this.invalidate(
        'consent.basis',
        'Voice imitation is currently limited to the recorded person’s own voice.',
      )
    }
  },
)

memoryRecordingSchema.pre(
  'validate',
  function validateTranscriptionState() {
    const transcriptionWasRequested =
      this.transcriptionStatus !==
      'not_requested'

    if (
      transcriptionWasRequested &&
      this.storageStatus !== 'stored'
    ) {
      this.invalidate(
        'transcriptionStatus',
        'Transcription requires a stored recording.',
      )
    }

    if (
      transcriptionWasRequested &&
      this.transcriptionProvider.length ===
        0
    ) {
      this.invalidate(
        'transcriptionProvider',
        'Requested transcription requires a provider.',
      )
    }

    if (
      transcriptionWasRequested &&
      this.transcriptionModel.length === 0
    ) {
      this.invalidate(
        'transcriptionModel',
        'Requested transcription requires a model.',
      )
    }

    if (
      this.transcriptionStatus ===
        'completed' &&
      !this.transcriptionCompletedAt
    ) {
      this.invalidate(
        'transcriptionCompletedAt',
        'Completed transcription requires a completion timestamp.',
      )
    }

    if (
      this.transcriptionStatus !==
        'completed' &&
      this.transcriptionCompletedAt
    ) {
      this.invalidate(
        'transcriptionCompletedAt',
        'A transcription completion timestamp is only allowed for completed transcription.',
      )
    }

    if (
      this.transcriptionStatus ===
        'failed' &&
      this.transcriptionFailureCode
        .length === 0
    ) {
      this.invalidate(
        'transcriptionFailureCode',
        'Failed transcription requires a failure code.',
      )
    }

    if (
      this.transcriptionStatus !==
        'failed' &&
      this.transcriptionFailureCode
        .length > 0
    ) {
      this.invalidate(
        'transcriptionFailureCode',
        'A transcription failure code is only allowed for failed transcription.',
      )
    }

  },
)

memoryRecordingSchema.pre(
  'validate',
  function validateLifecycleState() {
    if (
      this.lifecycleStatus ===
        'archived' &&
      !this.archivedAt
    ) {
      this.invalidate(
        'archivedAt',
        'Archived recordings require an archive timestamp.',
      )
    }

    if (
      this.lifecycleStatus ===
        'active' &&
      this.archivedAt
    ) {
      this.invalidate(
        'archivedAt',
        'Active recordings cannot have an archive timestamp.',
      )
    }
  },
)

memoryRecordingSchema.index(
  {
    memoryId: 1,
    lifecycleStatus: 1,
    createdAt: -1,
  },
  {
    name:
      'memory_recordings_memory_status_created',
  },
)

memoryRecordingSchema.index(
  {
    memoryId: 1,
    lifecycleStatus: 1,
    storageStatus: 1,
    'familyQuestionContext.questionId': 1,
  },
  {
    name:
      'memory_recordings_family_question',
  },
)

memoryRecordingSchema.index(
  {
    uploadedByUserId: 1,
    createdAt: -1,
  },
  {
    name:
      'memory_recordings_uploader_created',
  },
)

memoryRecordingSchema.index(
  {
    memoryId: 1,
    transcriptionStatus: 1,
    createdAt: 1,
  },
  {
    name:
      'memory_recordings_transcription_queue',
  },
)

memoryRecordingSchema.index(
  {
    memoryId: 1,
    lifecycleStatus: 1,
    storageStatus: 1,
    'interviewContext.promptKey': 1,
  },
  {
    name:
      'memory_recordings_guided_prompt',
  },
)

const MemoryRecording =
  models.MemoryRecording ??
  model(
    'MemoryRecording',
    memoryRecordingSchema,
  )

export default MemoryRecording
