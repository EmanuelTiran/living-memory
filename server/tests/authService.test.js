import {
    afterEach,
    describe,
    expect,
    it,
    vi,
  } from 'vitest'

  const mocks = vi.hoisted(() => ({
    userExists: vi.fn(),
    createUser: vi.fn(),
    findUser: vi.fn(),
    selectUser: vi.fn(),
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
    passwordNeedsRehash: vi.fn(),
    createAccessToken: vi.fn(),
    createRefreshSession: vi.fn(),
  }))

  vi.mock('../src/modules/auth/User.js', () => ({
    default: {
      exists: mocks.userExists,
      create: mocks.createUser,
      findOne: mocks.findUser,
    },
  }))

  vi.mock('../src/modules/auth/password.js', () => ({
    hashPassword: mocks.hashPassword,
    verifyPassword: mocks.verifyPassword,
    passwordNeedsRehash: mocks.passwordNeedsRehash,
  }))

  vi.mock('../src/modules/auth/tokens.js', () => ({
    createAccessToken: mocks.createAccessToken,
  }))

  vi.mock(
    '../src/modules/auth/sessionService.js',
    () => ({
      createRefreshSession:
        mocks.createRefreshSession,
    }),
  )

  import {
    loginUser,
    registerUser,
  } from '../src/modules/auth/authService.js'

  const validRegistration = {
    displayName: '  Emmanuel Tiran  ',
    email: '  USER@EXAMPLE.COM  ',
    password: 'a secure passphrase',
  }

  const validLogin = {
    email: '  USER@EXAMPLE.COM  ',
    password: 'existing-password',
  }

  const publicUser = {
    id: 'user-id',
    displayName: 'Emmanuel Tiran',
    email: 'user@example.com',
    systemRole: 'user',
    status: 'active',
  }

  function createStoredUser(overrides = {}) {
    return {
      _id: {
        toString: () => 'user-id',
      },
      displayName: 'Emmanuel Tiran',
      email: 'user@example.com',
      passwordHash: 'stored-password-hash',
      systemRole: 'user',
      status: 'active',
      save: vi.fn(),
      toJSON: () => publicUser,
      ...overrides,
    }
  }

  function configureUserLookup(user) {
    mocks.findUser.mockReturnValue({
      select: mocks.selectUser,
    })

    mocks.selectUser.mockResolvedValue(user)
  }

  function configureTokenIssuance() {
    mocks.createAccessToken.mockResolvedValue(
      'signed-access-token',
    )

    mocks.createRefreshSession.mockResolvedValue({
      refreshToken: 'raw-refresh-token',
      expiresAt: new Date(
        '2026-08-25T12:00:00.000Z',
      ),
    })
  }

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Authentication service', () => {
    describe('registerUser', () => {
      it('registers a new user safely', async () => {
        mocks.userExists.mockResolvedValue(null)

        mocks.hashPassword.mockResolvedValue(
          'stored-argon2-password-hash',
        )

        mocks.createUser.mockResolvedValue({
          toJSON: () => publicUser,
        })

        const result = await registerUser(
          validRegistration,
        )

        expect(mocks.userExists).toHaveBeenCalledWith({
          email: 'user@example.com',
        })

        expect(mocks.hashPassword).toHaveBeenCalledWith(
          'a secure passphrase',
        )

        expect(mocks.createUser).toHaveBeenCalledWith({
          displayName: 'Emmanuel Tiran',
          email: 'user@example.com',
          passwordHash:
            'stored-argon2-password-hash',
        })

        expect(result).toEqual(publicUser)

        expect(result).not.toHaveProperty(
          'passwordHash',
        )
      })

      it('rejects an email that already exists', async () => {
        mocks.userExists.mockResolvedValue({
          _id: 'existing-user-id',
        })

        await expect(
          registerUser(validRegistration),
        ).rejects.toMatchObject({
          name: 'AppError',
          statusCode: 409,
          code: 'EMAIL_ALREADY_REGISTERED',
        })

        expect(
          mocks.hashPassword,
        ).not.toHaveBeenCalled()

        expect(mocks.createUser).not.toHaveBeenCalled()
      })

      it('handles a concurrent duplicate email safely', async () => {
        mocks.userExists.mockResolvedValue(null)

        mocks.hashPassword.mockResolvedValue(
          'stored-argon2-password-hash',
        )

        mocks.createUser.mockRejectedValue({
          code: 11000,
        })

        await expect(
          registerUser(validRegistration),
        ).rejects.toMatchObject({
          name: 'AppError',
          statusCode: 409,
          code: 'EMAIL_ALREADY_REGISTERED',
        })
      })

      it('rejects invalid input before database access', async () => {
        await expect(
          registerUser({
            displayName: 'E',
            email: 'invalid-email',
            password: 'short',
          }),
        ).rejects.toMatchObject({
          name: 'ZodError',
        })

        expect(
          mocks.userExists,
        ).not.toHaveBeenCalled()

        expect(
          mocks.hashPassword,
        ).not.toHaveBeenCalled()

        expect(mocks.createUser).not.toHaveBeenCalled()
      })
    })

    describe('loginUser', () => {
      it('authenticates an active user', async () => {
        const user = createStoredUser()

        configureUserLookup(user)
        configureTokenIssuance()

        mocks.verifyPassword.mockResolvedValue(true)

        mocks.passwordNeedsRehash.mockReturnValue(
          false,
        )

        const result = await loginUser(validLogin)

        expect(mocks.findUser).toHaveBeenCalledWith({
          email: 'user@example.com',
        })

        expect(mocks.selectUser).toHaveBeenCalledWith(
          '+passwordHash',
        )

        expect(mocks.verifyPassword).toHaveBeenCalledWith(
          'stored-password-hash',
          'existing-password',
        )

        expect(
          mocks.createAccessToken,
        ).toHaveBeenCalledWith({
          userId: 'user-id',
          systemRole: 'user',
        })

        expect(
          mocks.createRefreshSession,
        ).toHaveBeenCalledWith({
          userId: 'user-id',
        })

        expect(result).toEqual({
          user: publicUser,
          accessToken: 'signed-access-token',
          refreshToken: 'raw-refresh-token',
          refreshTokenExpiresAt: new Date(
            '2026-08-25T12:00:00.000Z',
          ),
        })
      })

      it('returns a generic error for an unknown email', async () => {
        configureUserLookup(null)

        mocks.hashPassword.mockResolvedValue(
          'unused-password-hash',
        )

        await expect(
          loginUser(validLogin),
        ).rejects.toMatchObject({
          name: 'AppError',
          statusCode: 401,
          code: 'INVALID_CREDENTIALS',
        })

        expect(mocks.hashPassword).toHaveBeenCalledWith(
          'existing-password',
        )

        expect(
          mocks.verifyPassword,
        ).not.toHaveBeenCalled()

        expect(
          mocks.createAccessToken,
        ).not.toHaveBeenCalled()
      })

      it('returns a generic error for a wrong password', async () => {
        const user = createStoredUser()

        configureUserLookup(user)

        mocks.verifyPassword.mockResolvedValue(false)

        await expect(
          loginUser(validLogin),
        ).rejects.toMatchObject({
          name: 'AppError',
          statusCode: 401,
          code: 'INVALID_CREDENTIALS',
        })

        expect(
          mocks.createAccessToken,
        ).not.toHaveBeenCalled()

        expect(
          mocks.createRefreshSession,
        ).not.toHaveBeenCalled()
      })

      it('rejects a suspended account after password verification', async () => {
        const user = createStoredUser({
          status: 'suspended',
        })

        configureUserLookup(user)

        mocks.verifyPassword.mockResolvedValue(true)

        await expect(
          loginUser(validLogin),
        ).rejects.toMatchObject({
          name: 'AppError',
          statusCode: 403,
          code: 'ACCOUNT_SUSPENDED',
        })

        expect(
          mocks.createAccessToken,
        ).not.toHaveBeenCalled()

        expect(
          mocks.createRefreshSession,
        ).not.toHaveBeenCalled()
      })

      it('upgrades an outdated password hash', async () => {
        const user = createStoredUser()

        configureUserLookup(user)
        configureTokenIssuance()

        mocks.verifyPassword.mockResolvedValue(true)

        mocks.passwordNeedsRehash.mockReturnValue(true)

        mocks.hashPassword.mockResolvedValue(
          'upgraded-password-hash',
        )

        const result = await loginUser(validLogin)

        expect(mocks.hashPassword).toHaveBeenCalledWith(
          'existing-password',
        )

        expect(user.passwordHash).toBe(
          'upgraded-password-hash',
        )

        expect(user.save).toHaveBeenCalledOnce()

        expect(result.accessToken).toBe(
          'signed-access-token',
        )
      })

      it('rejects invalid login input before database access', async () => {
        await expect(
          loginUser({
            email: 'invalid-email',
            password: '',
          }),
        ).rejects.toMatchObject({
          name: 'ZodError',
        })

        expect(mocks.findUser).not.toHaveBeenCalled()

        expect(
          mocks.verifyPassword,
        ).not.toHaveBeenCalled()
      })
    })
  })
