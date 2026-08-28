import { z } from 'zod'
import {
  CHAT_RESPONSE_MODES,
} from './memoryChatPrompt.js'

export const CHAT_USER_MESSAGE_MAX_LENGTH =
  2000

export const CHAT_HISTORY_DEFAULT_LIMIT = 50

export const CHAT_HISTORY_MAX_LIMIT = 100

function objectIdSchema(label) {
  return z
    .string({
      error: `${label} must be a string.`,
    })
    .regex(/^[0-9a-f]{24}$/i, {
      error: `${label} must be valid.`,
    })
}

export const sendChatMessageSchema =
  z.strictObject({
    message: z
      .string({
        error:
          'Chat message must be a string.',
      })
      .trim()
      .min(1, {
        error:
          'Chat message must not be empty.',
      })
      .max(
        CHAT_USER_MESSAGE_MAX_LENGTH,
        {
          error:
            `Chat message must not exceed ${CHAT_USER_MESSAGE_MAX_LENGTH} characters.`,
        },
      ),

    responseMode: z
      .enum(CHAT_RESPONSE_MODES, {
        error:
          'Chat response mode must be balanced, archive, or creative.',
      })
      .optional(),
  })

export const chatMemoryParamsSchema =
  z.strictObject({
    memoryId:
      objectIdSchema('Memory ID'),
  })

export const chatConversationParamsSchema =
  z.strictObject({
    memoryId:
      objectIdSchema('Memory ID'),

    conversationId:
      objectIdSchema('Conversation ID'),
  })

export const chatHistoryQuerySchema =
  z.strictObject({
    limit: z.coerce
      .number({
        error:
          'History limit must be a number.',
      })
      .int({
        error:
          'History limit must be an integer.',
      })
      .min(1, {
        error:
          'History limit must be at least 1.',
      })
      .max(CHAT_HISTORY_MAX_LIMIT, {
        error:
          `History limit must not exceed ${CHAT_HISTORY_MAX_LIMIT}.`,
      })
      .default(
        CHAT_HISTORY_DEFAULT_LIMIT,
      ),

    beforeMessageId:
      objectIdSchema(
        'Before-message ID',
      ).optional(),
  })