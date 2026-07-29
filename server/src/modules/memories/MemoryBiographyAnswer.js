import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

export const BIOGRAPHY_ANSWER_ORIGINS =
  Object.freeze([
    'questionnaire',
    'creative_chat',
  ])

export const BIOGRAPHY_ANSWER_STATUSES =
  Object.freeze([
    'draft',
    'approved',
    'archived',
  ])

export const BIOGRAPHY_QUESTION_MAX_LENGTH =
  300

export const BIOGRAPHY_ANSWER_MAX_LENGTH =
  4000

const memoryBiographyAnswerSchema =
  new Schema(
    {
      memoryId: {
        type: Schema.Types.ObjectId,
        ref: 'MemoryProfile',
        required: true,
      },

      createdByUserId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },

      questionKey: {
        type: String,
        trim: true,
        maxlength: 80,
        default: '',
        match: [
          /^$|^[a-z][a-z0-9_]*$/,
          'Biography question key is invalid.',
        ],
      },

      question: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength:
          BIOGRAPHY_QUESTION_MAX_LENGTH,
      },

      answer: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength:
          BIOGRAPHY_ANSWER_MAX_LENGTH,
      },

      origin: {
        type: String,
        enum:
          BIOGRAPHY_ANSWER_ORIGINS,
        required: true,
      },

      sourceChatMessageId: {
        type: Schema.Types.ObjectId,
        ref: 'ChatMessage',
        default: null,
      },

      status: {
        type: String,
        enum:
          BIOGRAPHY_ANSWER_STATUSES,
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
        integer: true,
        min: 1,
        default: 1,
      },
    },
    {
      collection:
        'memory_biography_answers',
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

          return safeObject
        },
      },
    },
  )

memoryBiographyAnswerSchema.pre(
  'validate',
  function validateOrigin() {
    if (
      this.origin ===
      'questionnaire'
    ) {
      if (this.questionKey.length === 0) {
        this.invalidate(
          'questionKey',
          'Questionnaire answers require a question key.',
        )
      }

      if (this.sourceChatMessageId) {
        this.invalidate(
          'sourceChatMessageId',
          'Questionnaire answers cannot reference a chat message.',
        )
      }
    }

    if (
      this.origin ===
      'creative_chat'
    ) {
      if (!this.sourceChatMessageId) {
        this.invalidate(
          'sourceChatMessageId',
          'Creative chat answers require a source chat message.',
        )
      }

      if (this.questionKey.length > 0) {
        this.invalidate(
          'questionKey',
          'Creative chat answers cannot use a questionnaire key.',
        )
      }
    }
  },
)

memoryBiographyAnswerSchema.pre(
  'validate',
  function validateApproval() {
    if (this.status === 'approved') {
      if (!this.approvedAt) {
        this.invalidate(
          'approvedAt',
          'Approved biography answers require an approval timestamp.',
        )
      }

      if (!this.approvedByUserId) {
        this.invalidate(
          'approvedByUserId',
          'Approved biography answers require an approving user.',
        )
      }
    }

    if (this.status === 'draft') {
      if (this.approvedAt) {
        this.invalidate(
          'approvedAt',
          'Draft biography answers cannot have an approval timestamp.',
        )
      }

      if (this.approvedByUserId) {
        this.invalidate(
          'approvedByUserId',
          'Draft biography answers cannot have an approving user.',
        )
      }
    }
  },
)

memoryBiographyAnswerSchema.index(
  {
    memoryId: 1,
    status: 1,
    updatedAt: -1,
  },
  {
    name:
      'memory_biography_answers_memory_status_updated',
  },
)

memoryBiographyAnswerSchema.index(
  {
    memoryId: 1,
    origin: 1,
    sourceChatMessageId: 1,
  },
  {
    name:
      'memory_biography_answers_unique_creative_message',
    unique: true,
    partialFilterExpression: {
      origin: 'creative_chat',
      sourceChatMessageId: {
        $type: 'objectId',
      },
    },
  },
)

memoryBiographyAnswerSchema.index(
  {
    memoryId: 1,
    origin: 1,
    questionKey: 1,
  },
  {
    name:
      'memory_biography_answers_unique_question',
    unique: true,
    partialFilterExpression: {
      origin: 'questionnaire',
      questionKey: {
        $type: 'string',
      },
    },
  },
)

const MemoryBiographyAnswer =
  models.MemoryBiographyAnswer ??
  model(
    'MemoryBiographyAnswer',
    memoryBiographyAnswerSchema,
  )

export default MemoryBiographyAnswer