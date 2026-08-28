import { createHash } from 'node:crypto'
import {
  describe,
  expect,
  it,
} from 'vitest'
import MemoryInvitation from '../src/modules/memories/MemoryInvitation.js'
import MemoryParticipationConsent, {
  MEMORY_PARTICIPATION_POLICY_VERSION,
} from '../src/modules/memories/MemoryParticipationConsent.js'

const userId = '507f1f77bcf86cd799439010'
const memoryId = '507f1f77bcf86cd799439011'
const invitationId =
  '507f1f77bcf86cd799439012'

describe('Family access models', () => {
  it('never serializes an invitation token hash', async () => {
    const tokenHash = createHash('sha256')
      .update('private-token')
      .digest('hex')

    const invitation = new MemoryInvitation({
      memoryId,
      invitedByUserId: userId,
      invitedEmail: 'FAMILY@example.com',
      role: 'contributor',
      tokenHash,
      expiresAt: new Date(
        '2026-09-08T10:00:00.000Z',
      ),
    })

    await invitation.validate()

    expect(invitation.invitedEmail)
      .toBe('family@example.com')
    expect(invitation.toJSON())
      .not.toHaveProperty('tokenHash')
  })

  it('requires complete explicit participation consent', async () => {
    const consent =
      new MemoryParticipationConsent({
        memoryId,
        userId,
        invitationId,
        role: 'contributor',
        policyVersion:
          MEMORY_PARTICIPATION_POLICY_VERSION,
        attestations: {
          acceptsArchiveParticipation: true,
          acceptsRecordingAndTranscription:
            true,
          understandsGroundedAiUse: false,
        },
        acceptedAt: new Date(),
      })

    await expect(consent.validate())
      .rejects.toThrow(
        'Grounded AI use must be acknowledged.',
      )
  })

  it('recognizes steward as a valid family role', async () => {
    const invitation = new MemoryInvitation({
      memoryId,
      invitedByUserId: userId,
      invitedEmail: 'steward@example.com',
      role: 'steward',
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date(
        '2026-09-08T10:00:00.000Z',
      ),
    })

    await expect(invitation.validate())
      .resolves.toBeUndefined()
  })
})
