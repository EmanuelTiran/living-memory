import { z } from 'zod'

const objectIdSchema = z
  .string({
    error:
      'Memory ID must be a string.',
  })
  .regex(/^[0-9a-f]{24}$/i, {
    error: 'Memory ID must be valid.',
  })

export const digitalPersonaParamsSchema =
  z.strictObject({
    memoryId: objectIdSchema,
  })

export const selfConsentSchema =
  z.strictObject({
    subjectNameConfirmation: z
      .string({
        error:
          'Subject name confirmation must be a string.',
      })
      .trim()
      .min(2, {
        error:
          'Subject name confirmation must contain at least 2 characters.',
      })
      .max(100, {
        error:
          'Subject name confirmation must not exceed 100 characters.',
      }),

    confirmsOwnIdentity: z.literal(
      true,
      {
        error:
          'You must confirm that this memory represents you.',
      },
    ),

    permitsVoiceUse: z.literal(true, {
      error:
        'Voice-use permission is required.',
    }),

    permitsLikenessUse: z.literal(
      true,
      {
        error:
          'Likeness-use permission is required.',
      },
    ),

    understandsAiRepresentation:
      z.literal(true, {
        error:
          'AI representation acknowledgement is required.',
      }),

    acceptsSafetyRestrictions:
      z.literal(true, {
        error:
          'Safety restrictions must be accepted.',
      }),
  })

export const activateVoiceCloneSchema =
  z.strictObject({
    confirmsOwnVoice: z.literal(
      true,
      {
        error:
          'You must confirm that the reference sample contains your own voice.',
      },
    ),

    confirmsExistingVoiceClone:
      z.literal(true, {
        error:
          'You must confirm that the configured ElevenLabs clone is your voice.',
      }),

    permitsElevenLabsTextTransfer:
      z.literal(true, {
        error:
          'Permission to transfer speech text to ElevenLabs is required.',
      }),

    understandsElevenLabsRetention:
      z.literal(true, {
        error:
          'ElevenLabs processing and retention must be acknowledged.',
      }),
  })

export const activateDIDAvatarSchema =
  z.strictObject({
    confirmsOwnLikeness: z.literal(
      true,
      {
        error:
          'You must confirm that the avatar image represents you.',
      },
    ),

    confirmsAuthorizedAvatarImage:
      z.literal(true, {
        error:
          'You must confirm authorization to use the avatar image.',
      }),

    permitsDIDImageTransfer:
      z.literal(true, {
        error:
          'Permission to transfer the avatar image to D-ID is required.',
      }),

    permitsDIDAudioTransfer:
      z.literal(true, {
        error:
          'Permission to transfer generated audio to D-ID is required.',
      }),

    understandsDIDRetention:
      z.literal(true, {
        error:
          'D-ID processing and temporary retention must be acknowledged.',
      }),
  })

export const activateChatVoiceInputSchema =
  z.strictObject({
    confirmsOwnVoice: z.literal(
      true,
      {
        error:
          'You must confirm that the microphone recording contains your own voice.',
      },
    ),

    permitsOpenAIAudioTransfer:
      z.literal(true, {
        error:
          'Permission to transfer microphone audio to OpenAI is required.',
      }),

    understandsOpenAIProcessing:
      z.literal(true, {
        error:
          'OpenAI processing must be acknowledged.',
      }),

    understandsAudioNotStored:
      z.literal(true, {
        error:
          'Temporary audio handling must be acknowledged.',
      }),

    understandsManualReview:
      z.literal(true, {
        error:
          'Manual transcript review must be acknowledged.',
      }),
  })
