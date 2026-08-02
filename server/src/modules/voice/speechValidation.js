import { z } from 'zod'

const objectIdPattern =
  /^[0-9a-f]{24}$/i

function objectIdSchema(label) {
  return z
    .string({
      error:
        `${label} must be a string.`,
    })
    .regex(objectIdPattern, {
      error:
        `${label} must be valid.`,
    })
}

export const chatSpeechParamsSchema =
  z.strictObject({
    memoryId:
      objectIdSchema('Memory ID'),

    conversationId:
      objectIdSchema(
        'Conversation ID',
      ),

    messageId:
      objectIdSchema('Message ID'),
  })
