import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

export const CHAT_CONVERSATION_STATUSES =
  Object.freeze([
    'active',
    'archived',
  ])

const chatConversationSchema = new Schema(
  {
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

    status: {
      type: String,
      enum: CHAT_CONVERSATION_STATUSES,
      default: 'active',
    },

    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'chat_conversations',
    timestamps: true,
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

chatConversationSchema.index(
  {
    memoryId: 1,
    participantUserId: 1,
    lastMessageAt: -1,
  },
  {
    name:
      'chat_conversations_memory_participant_recent',
  },
)

chatConversationSchema.index(
  {
    participantUserId: 1,
    status: 1,
    lastMessageAt: -1,
  },
  {
    name:
      'chat_conversations_participant_status_recent',
  },
)

const ChatConversation =
  models.ChatConversation ??
  model(
    'ChatConversation',
    chatConversationSchema,
  )

export default ChatConversation