import { z } from 'zod'

const objectIdSchema = z
  .string({
    error: 'Identifier must be a string.',
  })
  .regex(/^[0-9a-f]{24}$/i, {
    error: 'Identifier must be valid.',
  })

const participantCodeSchema = z
  .string({
    error:
      'Participant code must be a string.',
  })
  .trim()
  .toUpperCase()
  .regex(/^[A-F0-9]{16}$/, {
    error:
      'Participant code must be valid.',
  })

export const pricingPilotMemoryParamsSchema =
  z.strictObject({
    memoryId: objectIdSchema,
  })

export const founderDecisionSchema =
  z.strictObject({
    decision: z.enum(
      ['interested', 'declined'],
      {
        error:
          'Founder decision is invalid.',
      },
    ),
  })

export const pricingParticipantParamsSchema =
  z.strictObject({
    participantCode:
      participantCodeSchema,
  })

export const founderPaymentActionSchema =
  z.strictObject({
    action: z.enum(
      ['verify_payment', 'record_refund'],
      {
        error:
          'Payment action is invalid.',
      },
    ),

    evidenceReference: z
      .string({
        error:
          'Evidence reference must be a string.',
      })
      .trim()
      .min(4, {
        error:
          'Evidence reference is too short.',
      })
      .max(200, {
        error:
          'Evidence reference is too long.',
      }),
  })
