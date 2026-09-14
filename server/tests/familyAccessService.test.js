import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  requireMemoryPermission: vi.fn(),
  userFindOne: vi.fn(),
  invitationUpdateMany: vi.fn(),
  invitationExists: vi.fn(),
  invitationCreate: vi.fn(),
  invitationFindOne: vi.fn(),
  invitationFindOneAndUpdate: vi.fn(),
  invitationUpdateOne: vi.fn(),
  membershipExists: vi.fn(),
  membershipFindOneAndUpdate: vi.fn(),
  consentUpdateOne: vi.fn(),
  memoryFindOneAndUpdate: vi.fn(),
  createFamilyInvitationUrl: vi.fn(),
  sendFamilyInvitationEmail: vi.fn(),
}))

vi.mock(
  '../src/modules/memories/memoryAccessService.js',
  () => ({
    MEMORY_PERMISSIONS: {
      VIEW: 'view',
      CHAT: 'chat',
      CONTRIBUTE: 'contribute',
      EDIT: 'edit',
      MANAGE: 'manage',
    },
    requireMemoryPermission:
      mocks.requireMemoryPermission,
  }),
)

vi.mock('../src/modules/auth/User.js', () => ({
  default: {
    findOne: mocks.userFindOne,
  },
}))

vi.mock(
  '../src/modules/memories/MemoryInvitation.js',
  () => ({
    default: {
      updateMany:
        mocks.invitationUpdateMany,
      exists: mocks.invitationExists,
      create: mocks.invitationCreate,
      findOne: mocks.invitationFindOne,
      findOneAndUpdate:
        mocks.invitationFindOneAndUpdate,
      updateOne:
        mocks.invitationUpdateOne,
    },
  }),
)

vi.mock(
  '../src/modules/memories/MemoryMembership.js',
  () => ({
    MEMORY_MEMBER_ROLES: [
      'viewer',
      'contributor',
      'editor',
      'steward',
    ],
    default: {
      exists: mocks.membershipExists,
      findOneAndUpdate:
        mocks.membershipFindOneAndUpdate,
    },
  }),
)

vi.mock(
  '../src/modules/memories/MemoryParticipationConsent.js',
  () => ({
    MEMORY_PARTICIPATION_POLICY_VERSION:
      'memory-participation-v1',
    default: {
      updateOne: mocks.consentUpdateOne,
    },
  }),
)

vi.mock(
  '../src/modules/memories/MemoryProfile.js',
  () => ({
    default: {
      findOneAndUpdate:
        mocks.memoryFindOneAndUpdate,
    },
  }),
)

vi.mock(
  '../src/modules/memories/familyInvitationMailService.js',
  () => ({
    createFamilyInvitationUrl:
      mocks.createFamilyInvitationUrl,
    sendFamilyInvitationEmail:
      mocks.sendFamilyInvitationEmail,
  }),
)

import {
  acceptMemoryInvitation,
  createMemoryInvitation,
} from '../src/modules/memories/familyAccessService.js'

const userId = '507f1f77bcf86cd799439010'
const memoryId = '507f1f77bcf86cd799439011'
const invitationId =
  '507f1f77bcf86cd799439012'
const now = new Date(
  '2026-08-25T10:00:00.000Z',
)

function selected(value) {
  return {
    select: vi.fn().mockResolvedValue(value),
  }
}

describe('Family access service', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.requireMemoryPermission
      .mockResolvedValue({
        memoryProfile: {
          _id: memoryId,
          ownerId: userId,
          subjectName: 'רות',
        },
        authorization: {
          role: 'owner',
        },
      })

    mocks.invitationUpdateMany
      .mockResolvedValue({
        modifiedCount: 0,
      })
    mocks.invitationExists
      .mockResolvedValue(null)
    mocks.membershipExists
      .mockResolvedValue(null)
    mocks.invitationUpdateOne
      .mockResolvedValue({
        modifiedCount: 1,
      })
    mocks.consentUpdateOne
      .mockResolvedValue({
        upsertedCount: 1,
      })
    mocks.createFamilyInvitationUrl
      .mockImplementation(
        (token) =>
          `https://zikaron-hai.co.il/invitation#token=${token}`,
      )
    mocks.sendFamilyInvitationEmail
      .mockResolvedValue(undefined)
  })

  it('creates a single-use invitation without returning its stored hash', async () => {
    mocks.userFindOne.mockReturnValue(
      selected(null),
    )
    mocks.invitationCreate
      .mockImplementation(
        async (invitation) => ({
          _id: invitationId,
          ...invitation,
          status: 'pending',
          acceptedAt: null,
          revokedAt: null,
          expiredAt: null,
          createdAt: now,
        }),
      )

    const result =
      await createMemoryInvitation(
        userId,
        memoryId,
        {
          email: ' FAMILY@EXAMPLE.COM ',
          role: 'contributor',
        },
        now,
      )

    const storedInvitation =
      mocks.invitationCreate.mock.calls[0][0]

    expect(result.token).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    )
    expect(result.invitationUrl).toBe(
      `https://zikaron-hai.co.il/invitation#token=${result.token}`,
    )
    expect(result.emailDelivery).toBe(
      'sent',
    )
    expect(storedInvitation.tokenHash)
      .toMatch(/^[0-9a-f]{64}$/)
    expect(storedInvitation.tokenHash)
      .not.toBe(result.token)
    expect(storedInvitation.invitedEmail)
      .toBe('family@example.com')
    expect(storedInvitation.expiresAt)
      .toEqual(
        new Date(
          '2026-09-08T10:00:00.000Z',
        ),
      )
    expect(result.invitation)
      .not.toHaveProperty('tokenHash')
    expect(storedInvitation)
      .not.toHaveProperty('token')
    expect(
      mocks.sendFamilyInvitationEmail,
    ).toHaveBeenCalledWith({
      to: 'family@example.com',
      invitationUrl:
        result.invitationUrl,
      subjectName: 'רות',
    })
    expect(
      mocks.invitationCreate.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      mocks.sendFamilyInvitationEmail.mock
        .invocationCallOrder[0],
    )
  })

  it('returns the invitation and raw token when email delivery fails', async () => {
    mocks.userFindOne.mockReturnValue(
      selected(null),
    )
    mocks.invitationCreate
      .mockImplementation(
        async (invitation) => ({
          _id: invitationId,
          ...invitation,
          status: 'pending',
          acceptedAt: null,
          revokedAt: null,
          expiredAt: null,
          createdAt: now,
        }),
      )
    mocks.sendFamilyInvitationEmail
      .mockRejectedValue(
        new Error('private provider failure'),
      )

    const result =
      await createMemoryInvitation(
        userId,
        memoryId,
        {
          email: ' FAMILY@EXAMPLE.COM ',
          role: 'viewer',
        },
        now,
      )

    expect(mocks.invitationCreate)
      .toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      emailDelivery: 'failed',
      invitationUrl:
        `https://zikaron-hai.co.il/invitation#token=${result.token}`,
      invitation: {
        invitedEmail: 'family@example.com',
        status: 'pending',
      },
    })
    expect(result.token).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    )
    expect(result.invitation)
      .not.toHaveProperty('tokenHash')
    expect(JSON.stringify(result))
      .not.toContain(
        'private provider failure',
      )
  })

  it('allows only the owner to assign steward access', async () => {
    mocks.requireMemoryPermission
      .mockResolvedValue({
        memoryProfile: {
          _id: memoryId,
          ownerId: '507f1f77bcf86cd799439099',
        },
        authorization: {
          role: 'steward',
        },
      })

    await expect(
      createMemoryInvitation(
        userId,
        memoryId,
        {
          email: 'family@example.com',
          role: 'steward',
        },
        now,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code:
        'MEMORY_STEWARD_MANAGEMENT_FORBIDDEN',
    })

    expect(mocks.invitationCreate)
      .not.toHaveBeenCalled()
  })

  it('records consent and activates membership before consuming the token', async () => {
    const token = 'a'.repeat(43)
    const pendingInvitation = {
      _id: invitationId,
      memoryId,
      invitedEmail: 'family@example.com',
      role: 'contributor',
      status: 'pending',
      expiresAt: new Date(
        '2026-09-08T10:00:00.000Z',
      ),
      tokenHash: 'b'.repeat(64),
    }
    const acceptedInvitation = {
      ...pendingInvitation,
      status: 'accepted',
      acceptedByUserId: userId,
      acceptedAt: now,
    }

    mocks.userFindOne.mockReturnValue(
      selected({
        _id: userId,
        email: 'family@example.com',
      }),
    )
    mocks.invitationFindOne.mockReturnValue(
      selected(pendingInvitation),
    )
    mocks.invitationFindOneAndUpdate
      .mockResolvedValue(
        acceptedInvitation,
      )
    mocks.membershipFindOneAndUpdate
      .mockResolvedValue({
        role: 'contributor',
      })
    mocks.memoryFindOneAndUpdate
      .mockResolvedValue({
        toJSON: () => ({
          id: memoryId,
          subjectName: 'רות',
          visibility: 'shared',
        }),
      })

    const result =
      await acceptMemoryInvitation(
        userId,
        {
          token,
          consent: {
            policyVersion:
              'memory-participation-v1',
            acceptsArchiveParticipation:
              true,
            acceptsRecordingAndTranscription:
              true,
            understandsGroundedAiUse: true,
          },
        },
        now,
      )

    expect(mocks.consentUpdateOne)
      .toHaveBeenCalledWith(
        {
          invitationId,
        },
        {
          $setOnInsert:
            expect.objectContaining({
              memoryId,
              userId,
              role: 'contributor',
              acceptedAt: now,
            }),
        },
        {
          upsert: true,
        },
      )
    expect(mocks.membershipFindOneAndUpdate)
      .toHaveBeenCalledWith(
        {
          memoryId,
          userId,
        },
        {
          $set: {
            role: 'contributor',
            status: 'active',
          },
        },
        expect.objectContaining({
          upsert: true,
          runValidators: true,
        }),
      )
    expect(mocks.memoryFindOneAndUpdate)
      .toHaveBeenCalledWith(
        {
          _id: memoryId,
          status: 'active',
        },
        {
          $set: {
            visibility: 'shared',
          },
        },
        {
          returnDocument: 'after',
        },
      )
    expect(mocks.invitationUpdateOne)
      .toHaveBeenCalledWith(
        {
          _id: invitationId,
          acceptedByUserId: userId,
        },
        {
          $unset: {
            tokenHash: 1,
          },
        },
      )
    expect(result.memoryProfile)
      .toMatchObject({
        id: memoryId,
        authorization: {
          role: 'contributor',
        },
      })
  })
})
