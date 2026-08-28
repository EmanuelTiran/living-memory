import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

export const FAMILY_QUESTION_STATUSES =
  Object.freeze([
    'active',
    'archived',
  ])

const familyQuestionSchema = new Schema(
  {
    memoryId: {
      type: Schema.Types.ObjectId,
      ref: 'MemoryProfile',
      required: true,
      immutable: true,
    },

    askedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },

    question: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 500,
      immutable: true,
    },

    status: {
      type: String,
      enum: FAMILY_QUESTION_STATUSES,
      default: 'active',
    },

    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'family_questions',
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

        delete safeObject.askedByUserId

        return safeObject
      },
    },
  },
)

familyQuestionSchema.pre(
  'validate',
  function validateArchiveState() {
    if (
      this.status === 'archived' &&
      !this.archivedAt
    ) {
      this.invalidate(
        'archivedAt',
        'Archived family questions require an archive timestamp.',
      )
    }

    if (
      this.status === 'active' &&
      this.archivedAt
    ) {
      this.invalidate(
        'archivedAt',
        'Active family questions cannot have an archive timestamp.',
      )
    }
  },
)

familyQuestionSchema.index(
  {
    memoryId: 1,
    status: 1,
    createdAt: -1,
  },
  {
    name:
      'family_questions_memory_status_created',
  },
)

familyQuestionSchema.index(
  {
    askedByUserId: 1,
    createdAt: -1,
  },
  {
    name:
      'family_questions_asker_created',
  },
)

const FamilyQuestion =
  models.FamilyQuestion ??
  model(
    'FamilyQuestion',
    familyQuestionSchema,
  )

export default FamilyQuestion
