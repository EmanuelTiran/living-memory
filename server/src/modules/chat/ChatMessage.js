import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

export const CHAT_MESSAGE_ROLES =
  Object.freeze([
    'user',
    'assistant',
  ])

export const CHAT_GROUNDING_STATUSES =
  Object.freeze([
    'not_applicable',
    'grounded',
    'inferred',
    'general_knowledge',
    'creative',
    'insufficient_context',
  ])

export const CHAT_MESSAGE_STORAGE_MAX_LENGTH =
  12000

const SOURCE_BACKED_GROUNDING_STATUSES =
  new Set([
    'grounded',
    'inferred',
  ])

const citationSchema = new Schema(
  {
    sourceType: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 50,
      match: [
        /^[a-z][a-z0-9_]*$/,
        'Citation source type is invalid.',
      ],
    },

    sourceId: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },

    excerpt: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    sourceVersion: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },
  },
  {
    _id: false,
  },
)

const chatMessageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatConversation',
      required: true,
    },

    memoryId: {
      type: Schema.Types.ObjectId,
      ref: 'MemoryProfile',
      required: true,
    },

    participantUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    role: {
      type: String,
      enum: CHAT_MESSAGE_ROLES,
      required: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength:
        CHAT_MESSAGE_STORAGE_MAX_LENGTH,
    },

    groundingStatus: {
      type: String,
      enum: CHAT_GROUNDING_STATUSES,
      default: 'not_applicable',
    },

    citations: {
      type: [citationSchema],
      default: [],
      validate: {
        validator(citations) {
          return citations.every(
            (citation) =>
              citation.approvedAt !== null ||
              citation.sourceVersion.length > 0,
          )
        },
        message:
          'Each citation must include an approval timestamp or source version.',
      },
    },
  },
  {
    collection: 'chat_messages',
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
    versionKey: false,
    toJSON: {
      transform(_document, returnedObject) {
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

chatMessageSchema.pre(
  'validate',
  function validateGroundingState() {
    const citations = this.citations ?? []

    if (this.role === 'user') {
      if (
        this.groundingStatus !==
        'not_applicable'
      ) {
        this.invalidate(
          'groundingStatus',
          'User messages cannot have a grounding status.',
        )
      }

      if (citations.length > 0) {
        this.invalidate(
          'citations',
          'User messages cannot contain citations.',
        )
      }

      return
    }

    if (this.role !== 'assistant') {
      return
    }

    if (
      this.groundingStatus ===
      'not_applicable'
    ) {
      this.invalidate(
        'groundingStatus',
        'Assistant messages require a grounding status.',
      )

      return
    }

    const requiresCitations =
      SOURCE_BACKED_GROUNDING_STATUSES.has(
        this.groundingStatus,
      )

    if (
      requiresCitations &&
      citations.length === 0
    ) {
      this.invalidate(
        'citations',
        'Source-backed assistant messages require at least one citation.',
      )
    }

    if (
      !requiresCitations &&
      citations.length > 0
    ) {
      this.invalidate(
        'citations',
        'This assistant message type cannot contain citations.',
      )
    }
  },
)

chatMessageSchema.index(
  {
    conversationId: 1,
    createdAt: 1,
    _id: 1,
  },
  {
    name:
      'chat_messages_conversation_chronological',
  },
)

chatMessageSchema.index(
  {
    memoryId: 1,
    participantUserId: 1,
    createdAt: -1,
  },
  {
    name:
      'chat_messages_memory_participant_recent',
  },
)

const ChatMessage =
  models.ChatMessage ??
  model('ChatMessage', chatMessageSchema)

export default ChatMessage