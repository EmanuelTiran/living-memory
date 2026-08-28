import { z } from 'zod'
import {
  MEMORY_MEMBER_ROLES,
} from './MemoryMembership.js'
import {
  MEMORY_PARTICIPATION_POLICY_VERSION,
} from './MemoryParticipationConsent.js'

const objectIdSchema = z
  .string({
    error: 'Identifier must be a string.',
  })
  .regex(/^[0-9a-f]{24}$/i, {
    error: 'Identifier must be valid.',
  })

const invitationTokenSchema = z
  .string({
    error:
      'Invitation token must be a string.',
  })
  .trim()
  .regex(/^[A-Za-z0-9_-]{43}$/, {
    error: 'Invitation token is invalid.',
  })

const memberRoleSchema = z.enum(
  MEMORY_MEMBER_ROLES,
  {
    error: 'Memory member role is invalid.',
  },
)

export const createMemoryInvitationSchema =
  z.strictObject({
    email: z
      .string({
        error:
          'Invitation email must be a string.',
      })
      .trim()
      .toLowerCase()
      .max(254, {
        error:
          'Invitation email is too long.',
      })
      .pipe(
        z.email({
          error:
            'Invitation email must be valid.',
        }),
      ),

    role: memberRoleSchema,
  })

export const previewMemoryInvitationSchema =
  z.strictObject({
    token: invitationTokenSchema,
  })

export const acceptMemoryInvitationSchema =
  z.strictObject({
    token: invitationTokenSchema,

    consent: z.strictObject({
      policyVersion: z.literal(
        MEMORY_PARTICIPATION_POLICY_VERSION,
        {
          error:
            'Participation policy version is invalid.',
        },
      ),

      acceptsArchiveParticipation:
        z.literal(true, {
          error:
            'Archive participation must be accepted.',
        }),

      acceptsRecordingAndTranscription:
        z.literal(true, {
          error:
            'Recording and transcription terms must be accepted.',
        }),

      understandsGroundedAiUse:
        z.literal(true, {
          error:
            'Grounded AI use must be acknowledged.',
        }),
    }),
  })

export const memoryInvitationParamsSchema =
  z.strictObject({
    memoryId: objectIdSchema,
    invitationId: objectIdSchema,
  })

export const memoryMembershipParamsSchema =
  z.strictObject({
    memoryId: objectIdSchema,
    membershipId: objectIdSchema,
  })

export const updateMemoryMembershipSchema =
  z.strictObject({
    role: memberRoleSchema,
  })
