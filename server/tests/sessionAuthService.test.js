import {
    afterEach,
    describe,
    expect,
    it,
    vi,
  } from 'vitest'

  const mocks = vi.hoisted(() => ({
    findUserById: vi.fn(),
    rotateRefreshSession: vi.fn(),
    revokeRefreshSession: vi.fn(),
    revokeRefreshSessionFamily: vi.fn(),
    createAccessToken: vi.fn(),
  }))

  vi.mock('../src/modules/auth/User.js', () => ({
    default: {
      findById: mocks.findUserById,
    },
  }))

  vi.mock(
    '../src/modules/auth/sessionService.js',
    () => ({
      rotateRefreshSession:
        mocks.rotateRefreshSession,
      revokeRefreshSession:
        mocks.revokeRefreshSession,
      revokeRefreshSessionFamily:
        mocks.revokeRefreshSessionFamily,
    }),
  )

  vi.mock('../src/modules/auth/tokens.js', () => ({
    createAccessToken: mocks.createAccessToken,
  }))

  import {
    logoutUser,
    refreshAuthentication,
  } from '../src/modules/auth/sessionAuthService.js'

  const familyId =
    '1d4d17ac-4014-4cd6-a33e-e6cb3939d918'

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
      systemRole: 'user',
      status: 'active',
      toJSON: () => publicUser,
      ...overrides,
    }
  }

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Session authentication service', () => {
    it('rotates a session and creates a new access token', async () => {
      const expiresAt = new Date(
        '2026-08-25T12:00:00.000Z',
      )

      mocks.rotateRefreshSession.mockResolvedValue({
        userId: 'user-id',
        familyId,
        refreshToken: 'next-refresh-token',
        expiresAt,
      })

      mocks.findUserById.mockResolvedValue(
        createStoredUser(),
      )

      mocks.createAccessToken.mockResolvedValue(
        'next-access-token',
      )

      const result = await refreshAuthentication(
        'current-refresh-token',
      )

      expect(
        mocks.rotateRefreshSession,
      ).toHaveBeenCalledWith(
        'current-refresh-token',
      )

      expect(mocks.findUserById).toHaveBeenCalledWith(
        'user-id',
      )

      expect(
        mocks.createAccessToken,
      ).toHaveBeenCalledWith({
        userId: 'user-id',
        systemRole: 'user',
      })

      expect(result).toEqual({
        user: publicUser,
        accessToken: 'next-access-token',
        refreshToken: 'next-refresh-token',
        refreshTokenExpiresAt: expiresAt,
      })
    })

    it('rejects a missing refresh token', async () => {
      await expect(
        refreshAuthentication(undefined),
      ).rejects.toMatchObject({
        name: 'AppError',
        statusCode: 401,
        code: 'INVALID_REFRESH_TOKEN',
      })

      expect(
        mocks.rotateRefreshSession,
      ).not.toHaveBeenCalled()
    })

    it('revokes the session family when the user no longer exists', async () => {
      mocks.rotateRefreshSession.mockResolvedValue({
        userId: 'missing-user-id',
        familyId,
        refreshToken: 'next-refresh-token',
        expiresAt: new Date(),
      })

      mocks.findUserById.mockResolvedValue(null)

      await expect(
        refreshAuthentication('refresh-token'),
      ).rejects.toMatchObject({
        name: 'AppError',
        statusCode: 401,
        code: 'INVALID_REFRESH_TOKEN',
      })

      expect(
        mocks.revokeRefreshSessionFamily,
      ).toHaveBeenCalledWith(
        familyId,
        'security',
      )

      expect(
        mocks.createAccessToken,
      ).not.toHaveBeenCalled()
    })

    it('revokes the session family for a suspended user', async () => {
      mocks.rotateRefreshSession.mockResolvedValue({
        userId: 'user-id',
        familyId,
        refreshToken: 'next-refresh-token',
        expiresAt: new Date(),
      })

      mocks.findUserById.mockResolvedValue(
        createStoredUser({
          status: 'suspended',
        }),
      )

      await expect(
        refreshAuthentication('refresh-token'),
      ).rejects.toMatchObject({
        name: 'AppError',
        statusCode: 401,
        code: 'INVALID_REFRESH_TOKEN',
      })

      expect(
        mocks.revokeRefreshSessionFamily,
      ).toHaveBeenCalledWith(
        familyId,
        'security',
      )

      expect(
        mocks.createAccessToken,
      ).not.toHaveBeenCalled()
    })

    it('revokes an existing token during logout', async () => {
      mocks.revokeRefreshSession.mockResolvedValue(
        undefined,
      )

      await logoutUser('refresh-token')

      expect(
        mocks.revokeRefreshSession,
      ).toHaveBeenCalledWith('refresh-token')

      await logoutUser(undefined)

      expect(
        mocks.revokeRefreshSession,
      ).toHaveBeenCalledOnce()
    })
  })
