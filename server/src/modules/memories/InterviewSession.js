import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

export const INTERVIEW_SESSION_STATUSES =
  Object.freeze([
    'active',
    'completed',
  ])

const interviewPromptSnapshotSchema =
  new Schema(
    {
      key: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80,
        immutable: true,
      },

      category: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80,
        immutable: true,
      },

      question: {
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

const interviewSessionSchema =
  new Schema(
    {
      memoryId: {
        type: Schema.Types.ObjectId,
        ref: 'MemoryProfile',
        required: true,
        immutable: true,
      },

      startedByUserId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        immutable: true,
      },

      promptSnapshot: {
        type: interviewPromptSnapshotSchema,
        required: true,
        immutable: true,
      },

      status: {
        type: String,
        enum: INTERVIEW_SESSION_STATUSES,
        default: 'active',
      },

      startedAt: {
        type: Date,
        required: true,
        default: Date.now,
        immutable: true,
      },

      completedAt: {
        type: Date,
        default: null,
      },
    },
    {
      collection: 'interview_sessions',
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

          delete safeObject.startedByUserId

          return safeObject
        },
      },
    },
  )

interviewSessionSchema.pre(
  'validate',
  function validateCompletionState() {
    if (
      this.status === 'completed' &&
      !this.completedAt
    ) {
      this.invalidate(
        'completedAt',
        'Completed interview sessions require a completion timestamp.',
      )
    }

    if (
      this.status === 'active' &&
      this.completedAt
    ) {
      this.invalidate(
        'completedAt',
        'Active interview sessions cannot have a completion timestamp.',
      )
    }
  },
)

interviewSessionSchema.index({
  memoryId: 1,
  createdAt: -1,
})

const InterviewSession =
  models.InterviewSession ??
  model(
    'InterviewSession',
    interviewSessionSchema,
  )

export default InterviewSession
