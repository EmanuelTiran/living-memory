import { createHash } from 'node:crypto'
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  invitationExists: vi.fn(),
}))

vi.mock(
  '../src/modules/memories/MemoryInvitation.js',
  () => ({
    default: {
      exists: mocks.invitationExists,
    },
  }),
)

import {
  requireRegistrationInvitation,
} from '../src/modules/auth/registrationAccessService.js'

const invitationToken = 'a'.repeat(43)
const now = new Date(
  '2026-08-27T12:00:00.000Z',
)

afterEach(() => {
  vi.resetAllMocks()
})

describe('Private-pilot registration access', () => {
  it('does nothing when invite-only mode is disabled', async () => {
    await expect(
      requireRegistrationInvitation(
        {
          email: 'user@example.com',
        },
        {
          inviteOnly: false,
          now,
        },
      ),
    ).resolves.toBeUndefined()

    expect(
      mocks.invitationExists,
    ).not.toHaveBeenCalled()
  })

  it('requires a token in invite-only mode', async () => {
    await expect(
      requireRegistrationInvitation(
        {
          email: 'user@example.com',
        },
        {
          inviteOnly: true,
          now,
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code:
        'REGISTRATION_INVITATION_REQUIRED',
    })
  })

  it('accepts a pending invitation for the exact email', async () => {
    mocks.invitationExists.mockResolvedValue({
      _id: 'invitation-id',
    })

    await expect(
      requireRegistrationInvitation(
        {
          email: 'user@example.com',
          invitationToken,
        },
        {
          inviteOnly: true,
          now,
        },
      ),
    ).resolves.toBeUndefined()

    expect(
      mocks.invitationExists,
    ).toHaveBeenCalledWith({
      tokenHash: createHash('sha256')
        .update(invitationToken)
        .digest('hex'),
      invitedEmail: 'user@example.com',
      status: 'pending',
      expiresAt: {
        $gt: now,
      },
    })
  })

  it('rejects an unavailable invitation', async () => {
    mocks.invitationExists.mockResolvedValue(null)

    await expect(
      requireRegistrationInvitation(
        {
          email: 'other@example.com',
          invitationToken,
        },
        {
          inviteOnly: true,
          now,
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code:
        'REGISTRATION_INVITATION_INVALID',
    })
  })
})
