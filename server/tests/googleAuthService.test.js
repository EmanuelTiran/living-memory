import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  userFindOne: vi.fn(),
  userFindOneAndUpdate: vi.fn(),
  userCreate: vi.fn(),
  verifyGoogleCredential: vi.fn(),
  requireRegistrationInvitation: vi.fn(),
  assertUserCanAuthenticate: vi.fn(),
  createAuthenticationForUser: vi.fn(),
}))

vi.mock('../src/modules/auth/User.js', () => ({
  default: {
    findOne: mocks.userFindOne,
    findOneAndUpdate:
      mocks.userFindOneAndUpdate,
    create: mocks.userCreate,
  },
}))

vi.mock(
  '../src/modules/auth/googleIdentityService.js',
  () => ({
    verifyGoogleCredential:
      mocks.verifyGoogleCredential,
  }),
)

vi.mock(
  '../src/modules/auth/registrationAccessService.js',
  () => ({
    requireRegistrationInvitation:
      mocks.requireRegistrationInvitation,
  }),
)

vi.mock('../src/modules/auth/authService.js', () => ({
  assertUserCanAuthenticate:
    mocks.assertUserCanAuthenticate,
  createAuthenticationForUser:
    mocks.createAuthenticationForUser,
}))

import {
  authenticateWithGoogle,
} from '../src/modules/auth/googleAuthService.js'

const credential =
  `${'a'.repeat(40)}.${'b'.repeat(40)}.${'c'.repeat(40)}`
const invitationToken = 'i'.repeat(43)

const gmailIdentity = {
  subject: 'google-subject-123',
  email: 'user@gmail.com',
  displayName: 'Google User',
  hostedDomain: '',
  isAuthoritativeEmail: true,
}

function createUser(overrides = {}) {
  const user = {
    _id: {
      toString: () =>
        overrides.id ?? 'user-id',
    },
    displayName: 'Existing Name',
    email: 'user@gmail.com',
    passwordHash: 'existing-password-hash',
    systemRole: 'admin',
    status: 'active',
    toJSON() {
      return {
        id: this._id.toString(),
        displayName: this.displayName,
        email: this.email,
        systemRole: this.systemRole,
        status: this.status,
      }
    },
    ...overrides,
  }

  delete user.id
  return user
}

function createSelectedQuery(value) {
  return {
    select: vi.fn().mockResolvedValue(value),
  }
}

function configureLookups({
  subjectUser = null,
  emailUser = null,
} = {}) {
  mocks.userFindOne.mockImplementation(
    (filter) =>
      createSelectedQuery(
        filter.googleSubject
          ? subjectUser
          : emailUser,
      ),
  )
}

beforeEach(() => {
  vi.resetAllMocks()

  mocks.verifyGoogleCredential.mockResolvedValue(
    gmailIdentity,
  )
  mocks.requireRegistrationInvitation.mockResolvedValue()
  mocks.assertUserCanAuthenticate.mockImplementation(
    (user) => {
      if (user.status !== 'active') {
        throw Object.assign(
          new Error('Account suspended'),
          {
            statusCode: 403,
            code: 'ACCOUNT_SUSPENDED',
          },
        )
      }
    },
  )
  mocks.createAuthenticationForUser.mockImplementation(
    async (user) => {
      mocks.assertUserCanAuthenticate(user)

      return {
        user: user.toJSON(),
        accessToken: 'living-memory-access-token',
        refreshToken: 'living-memory-refresh-token',
        refreshTokenExpiresAt: new Date(
          '2026-10-01T12:00:00.000Z',
        ),
      }
    },
  )
})

describe('Google authentication service', () => {
  it('synchronizes a changed authoritative email before authenticating an existing Google subject', async () => {
    const linkedUser = createUser({
      email: 'stored@example.com',
      googleSubject: gmailIdentity.subject,
    })
    const updatedUser = createUser({
      email: gmailIdentity.email,
      googleSubject: gmailIdentity.subject,
    })
    configureLookups({ subjectUser: linkedUser })
    mocks.userFindOneAndUpdate.mockReturnValue(
      createSelectedQuery(updatedUser),
    )

    const result = await authenticateWithGoogle({
      credential,
    })

    expect(result.user.email).toBe(
      gmailIdentity.email,
    )
    expect(
      mocks.userFindOneAndUpdate,
    ).toHaveBeenCalledWith(
      {
        _id: linkedUser._id,
        email: 'stored@example.com',
        googleSubject: gmailIdentity.subject,
        status: 'active',
      },
      {
        $set: {
          email: gmailIdentity.email,
        },
        $unset: {
          passwordResetTokenHash: 1,
          passwordResetExpiresAt: 1,
        },
      },
      {
        returnDocument: 'after',
        runValidators: true,
      },
    )
    expect(
      mocks.createAuthenticationForUser,
    ).toHaveBeenCalledWith(updatedUser)
    expect(mocks.userCreate).not.toHaveBeenCalled()
  })

  it('authenticates a subject with an unchanged email without a database write', async () => {
    const linkedUser = createUser({
      googleSubject: gmailIdentity.subject,
    })
    configureLookups({ subjectUser: linkedUser })

    await authenticateWithGoogle({ credential })

    expect(
      mocks.userFindOneAndUpdate,
    ).not.toHaveBeenCalled()
    expect(mocks.userCreate).not.toHaveBeenCalled()
  })

  it('blocks a suspended subject-linked account', async () => {
    const suspendedUser = createUser({
      googleSubject: gmailIdentity.subject,
      status: 'suspended',
    })
    configureLookups({ subjectUser: suspendedUser })

    await expect(
      authenticateWithGoogle({ credential }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'ACCOUNT_SUSPENDED',
    })
  })

  it.each([
    {
      label: 'Gmail',
      identity: gmailIdentity,
    },
    {
      label: 'Workspace',
      identity: {
        ...gmailIdentity,
        email: 'user@example.org',
        hostedDomain: 'example.org',
      },
    },
  ])(
    'refuses to auto-link an existing password account with an authoritative $label email',
    async ({ identity }) => {
      const existingUser = createUser({
        email: identity.email,
      })

      mocks.verifyGoogleCredential.mockResolvedValue(
        identity,
      )
      configureLookups({ emailUser: existingUser })

      await expect(
        authenticateWithGoogle({ credential }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'GOOGLE_ACCOUNT_LINK_REQUIRED',
      })

      expect(
        mocks.userFindOneAndUpdate,
      ).not.toHaveBeenCalled()
      expect(
        mocks.createAuthenticationForUser,
      ).not.toHaveBeenCalled()
    },
  )

  it('rejects an authoritative email change when another account owns the new email', async () => {
    const linkedUser = createUser({
      email: 'old@example.org',
      googleSubject: gmailIdentity.subject,
    })
    configureLookups({ subjectUser: linkedUser })
    mocks.userFindOneAndUpdate.mockReturnValue({
      select: vi.fn().mockRejectedValue({
        code: 11000,
      }),
    })

    await expect(
      authenticateWithGoogle({ credential }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'GOOGLE_ACCOUNT_LINK_REQUIRED',
    })

    expect(
      mocks.createAuthenticationForUser,
    ).not.toHaveBeenCalled()
  })

  it('uses the stable subject without adopting a changed non-authoritative email', async () => {
    const linkedUser = createUser({
      email: 'old-workspace@example.org',
      googleSubject: gmailIdentity.subject,
    })
    mocks.verifyGoogleCredential.mockResolvedValue({
      ...gmailIdentity,
      email: 'consumer@example.net',
      isAuthoritativeEmail: false,
    })
    configureLookups({ subjectUser: linkedUser })

    const result = await authenticateWithGoogle({
      credential,
    })

    expect(result.user.email).toBe(
      'old-workspace@example.org',
    )
    expect(
      mocks.userFindOneAndUpdate,
    ).not.toHaveBeenCalled()
  })

  it('does not automatically link a third-party Google email collision', async () => {
    const existingUser = createUser({
      email: 'user@example.org',
    })
    mocks.verifyGoogleCredential.mockResolvedValue({
      ...gmailIdentity,
      email: 'user@example.org',
      isAuthoritativeEmail: false,
    })
    configureLookups({ emailUser: existingUser })

    await expect(
      authenticateWithGoogle({ credential }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'GOOGLE_ACCOUNT_LINK_REQUIRED',
    })

    expect(
      mocks.userFindOneAndUpdate,
    ).not.toHaveBeenCalled()
  })

  it('does not replace a different Google subject already attached to an email account', async () => {
    const existingUser = createUser({
      googleSubject: 'different-google-subject',
    })
    configureLookups({ emailUser: existingUser })

    await expect(
      authenticateWithGoogle({ credential }),
    ).rejects.toMatchObject({
      code: 'GOOGLE_ACCOUNT_LINK_REQUIRED',
    })

    expect(
      mocks.userFindOneAndUpdate,
    ).not.toHaveBeenCalled()
  })

  it('requires the existing invitation policy for a new Google user', async () => {
    configureLookups()
    mocks.requireRegistrationInvitation.mockRejectedValue(
      Object.assign(
        new Error('Invitation required'),
        {
          statusCode: 403,
          code: 'REGISTRATION_INVITATION_REQUIRED',
        },
      ),
    )

    await expect(
      authenticateWithGoogle({ credential }),
    ).rejects.toMatchObject({
      code: 'REGISTRATION_INVITATION_REQUIRED',
    })

    expect(
      mocks.requireRegistrationInvitation,
    ).toHaveBeenCalledWith({
      email: gmailIdentity.email,
      invitationToken: undefined,
    })
    expect(mocks.userCreate).not.toHaveBeenCalled()
  })

  it.each([
    'REGISTRATION_INVITATION_INVALID',
    'REGISTRATION_INVITATION_REQUIRED',
  ])('preserves invitation failure %s', async (code) => {
    configureLookups()
    mocks.requireRegistrationInvitation.mockRejectedValue(
      Object.assign(new Error('Invitation failed'), {
        statusCode: 403,
        code,
      }),
    )

    await expect(
      authenticateWithGoogle({
        credential,
        invitationToken,
      }),
    ).rejects.toMatchObject({ code })

    expect(
      mocks.requireRegistrationInvitation,
    ).toHaveBeenCalledWith({
      email: gmailIdentity.email,
      invitationToken,
    })
  })

  it('creates an invited Google-only user and issues normal authentication', async () => {
    const newUser = createUser({
      googleSubject: gmailIdentity.subject,
      passwordHash: undefined,
    })
    configureLookups()
    mocks.userCreate.mockResolvedValue(newUser)

    const result = await authenticateWithGoogle({
      credential,
      invitationToken,
    })

    expect(mocks.userCreate).toHaveBeenCalledWith({
      displayName: 'Google User',
      email: gmailIdentity.email,
      googleSubject: gmailIdentity.subject,
    })
    expect(
      mocks.userCreate.mock.calls[0][0],
    ).not.toHaveProperty('passwordHash')
    expect(result).toMatchObject({
      accessToken: 'living-memory-access-token',
      refreshToken: 'living-memory-refresh-token',
    })
  })

  it('uses a safe display-name fallback for a new user', async () => {
    const identity = {
      ...gmailIdentity,
      email: 'family.member@gmail.com',
      displayName: '',
    }
    const newUser = createUser({
      displayName: 'family member',
      email: identity.email,
      googleSubject: identity.subject,
      passwordHash: undefined,
    })

    mocks.verifyGoogleCredential.mockResolvedValue(
      identity,
    )
    configureLookups()
    mocks.userCreate.mockResolvedValue(newUser)

    await authenticateWithGoogle({ credential })

    expect(mocks.userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'family member',
      }),
    )
  })

  it('rejects automatic registration for a third-party Google email', async () => {
    mocks.verifyGoogleCredential.mockResolvedValue({
      ...gmailIdentity,
      email: 'user@example.org',
      isAuthoritativeEmail: false,
    })
    configureLookups()

    await expect(
      authenticateWithGoogle({
        credential,
        invitationToken,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'GOOGLE_REGISTRATION_UNAVAILABLE',
    })

    expect(
      mocks.requireRegistrationInvitation,
    ).not.toHaveBeenCalled()
    expect(mocks.userCreate).not.toHaveBeenCalled()
  })

  it('authenticates the subject owner instead of relinking another email account', async () => {
    const subjectOwner = createUser({
      id: 'subject-owner-id',
      email: gmailIdentity.email,
      googleSubject: gmailIdentity.subject,
    })
    configureLookups({
      subjectUser: subjectOwner,
      emailUser: createUser(),
    })

    const result = await authenticateWithGoogle({
      credential,
    })

    expect(result.user.id).toBe('subject-owner-id')
    expect(
      mocks.userFindOneAndUpdate,
    ).not.toHaveBeenCalled()
  })

  it('refuses to link when password registration wins a concurrent create race', async () => {
    const passwordWinner = createUser()
    let subjectLookupCount = 0

    mocks.userFindOne.mockImplementation(
      (filter) => {
        if (filter.googleSubject) {
          subjectLookupCount += 1
          return createSelectedQuery(
            null,
          )
        }

        return createSelectedQuery(
          subjectLookupCount === 1
            ? null
            : passwordWinner,
        )
      },
    )
    mocks.userCreate.mockRejectedValue({
      code: 11000,
    })

    await expect(
      authenticateWithGoogle({
        credential,
        invitationToken,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'GOOGLE_ACCOUNT_LINK_REQUIRED',
    })

    expect(subjectLookupCount).toBe(2)
    expect(
      mocks.userFindOneAndUpdate,
    ).not.toHaveBeenCalled()
    expect(
      mocks.createAuthenticationForUser,
    ).not.toHaveBeenCalled()
  })

  it('resolves a concurrent create race without creating a duplicate account', async () => {
    const createdWinner = createUser({
      googleSubject: gmailIdentity.subject,
      passwordHash: undefined,
    })
    let subjectLookupCount = 0

    mocks.userFindOne.mockImplementation(
      (filter) => {
        if (filter.googleSubject) {
          subjectLookupCount += 1
          return createSelectedQuery(
            subjectLookupCount === 1
              ? null
              : createdWinner,
          )
        }

        return createSelectedQuery(null)
      },
    )
    mocks.userCreate.mockRejectedValue({
      code: 11000,
    })

    const result = await authenticateWithGoogle({
      credential,
      invitationToken,
    })

    expect(result.user.id).toBe('user-id')
    expect(mocks.userCreate).toHaveBeenCalledOnce()
    expect(subjectLookupCount).toBe(2)
  })
})
