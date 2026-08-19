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

export const realtimeAvatarSpeechChunkParamsSchema =
  chatSpeechParamsSchema.extend({
    chunkIndex: z.coerce
      .number({
        error:
          'Speech chunk index must be a number.',
      })
      .int({
        error:
          'Speech chunk index must be an integer.',
      })
      .min(0, {
        error:
          'Speech chunk index must be at least zero.',
      })
      .max(5, {
        error:
          'Speech chunk index must not exceed five.',
      }),
  })

export const avatarJobParamsSchema =
  z.strictObject({
    memoryId:
      objectIdSchema('Memory ID'),

    avatarJobId: z
      .string({
        error:
          'Avatar job ID must be a string.',
      })
      .uuid({
        error:
          'Avatar job ID must be valid.',
      }),
  })

export const realtimeAudioParamsSchema =
  z.strictObject({
    memoryId:
      objectIdSchema('Memory ID'),

    realtimeAudioToken: z
      .string({
        error:
          'Realtime audio token must be a string.',
      })
      .uuid({
        error:
          'Realtime audio token must be valid.',
      }),
  })
