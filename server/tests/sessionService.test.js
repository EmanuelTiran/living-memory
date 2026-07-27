import {
    afterEach,
    describe,
    expect,
    it,
    vi,
  } from 'vitest'

  const mocks = vi.hoisted(() => ({
    sessionCreate: vi.fn(),
    sessionFindOne: vi.fn(),
    sessionFindOneAndUpdate: vi.fn(),
    sessionUpdateOne: vi.fn(),
    sessionUpdateMany: vi.fn(),
    createRefreshToken: vi.fn(),
    hashRefreshToken: vi.fn(),
    createExpirationDate: vi.fn(),
  }))

  vi.mock('../src/modules/auth/Session.js', () => ({
    default: {
      create: mocks.sessionCreate,
      findOne: mocks.sessionFindOne,
      findOneAndUpdate:
        mocks.sessionFindOneAndUpdate,
      updateOne: mocks.sessionUpdateOne,
      updateMany: mocks.sessionUpdateMany,
    },
  }))

  vi.mock('../src/modules/auth/tokens.js', () => ({
    createRefreshToken: mocks.createRefreshToken,
    hashRefreshToken: mocks.hashRefreshToken,
    createRefreshTokenExpirationDate:
      mocks.createExpirationDate,
  }))

  import {
    createRefreshSession,
    revokeRefreshSession,
    rotateRefreshSession,
  } from '../src/modules/auth/sessionService.js'

  const familyId =
    '1d4d17ac-4014-4cd6-a33e-e6cb3939d918'

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Refresh-session service', () => {
    it('creates a refresh session safely', async () => {
      const expiresAt = new Date(
        '2026-08-25T12:00:00.000Z',
      )

      mocks.createRefreshToken.mockReturnValue(
        'raw-refresh-token',
      )

      mocks.hashRefreshToken.mockReturnValue(
        'a'.repeat(64),
      )

      mocks.createExpirationDate.mockReturnValue(
        expiresAt,
      )

      mocks.sessionCreate.mockResolvedValue({
        _id: {
          toString: () => 'session-id',
        },
        familyId,
        expiresAt,
      })

      const result = await createRefreshSession({
        userId: 'user-id',
        familyId,
      })

      expect(mocks.sessionCreate).toHaveBeenCalledWith({
        userId: 'user-id',
        refreshTokenHash: 'a'.repeat(64),
        familyId,
        expiresAt,
      })

      expect(result).toEqual({
        refreshToken: 'raw-refresh-token',
        sessionId: 'session-id',
        familyId,
        expiresAt,
      })
    })

    it('rotates an active refresh session', async () => {
      const currentSession = {
        _id: 'current-session-id',
        userId: {
          toString: () => 'user-id',
        },
        familyId,
        revokedAt: null,
        expiresAt: new Date(
          Date.now() + 60 * 60 * 1000,
        ),
      }

      const nextExpiration = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      )

      mocks.hashRefreshToken.mockReturnValue(
        'b'.repeat(64),
      )

      mocks.sessionFindOne.mockResolvedValue(
        currentSession,
      )

      mocks.sessionFindOneAndUpdate.mockResolvedValue(
        currentSession,
      )

      mocks.createRefreshToken.mockReturnValue(
        'next-refresh-token',
      )

      mocks.createExpirationDate.mockReturnValue(
        nextExpiration,
      )

      mocks.sessionCreate.mockResolvedValue({
        _id: {
          toString: () => 'next-session-id',
        },
        familyId,
        expiresAt: nextExpiration,
      })

      mocks.sessionUpdateOne.mockResolvedValue({
        acknowledged: true,
      })

      const result = await rotateRefreshSession(
        'current-refresh-token',
      )

      expect(
        mocks.sessionFindOneAndUpdate,
      ).toHaveBeenCalledWith(
        {
          _id: 'current-session-id',
          revokedAt: null,
          expiresAt: {
            $gt: expect.any(Date),
          },
        },
        {
          $set: {
            revokedAt: expect.any(Date),
            revocationReason: 'rotated',
            lastUsedAt: expect.any(Date),
          },
        },
        {
          returnDocument: 'after',
        },
      )

      expect(
        mocks.sessionUpdateOne,
      ).toHaveBeenCalledWith(
        {
          _id: 'current-session-id',
        },
        {
          $set: {
            replacedBySessionId:
              'next-session-id',
          },
        },
      )

      expect(result).toEqual({
        refreshToken: 'next-refresh-token',
        sessionId: 'next-session-id',
        familyId,
        expiresAt: nextExpiration,
        userId: 'user-id',
      })
    })

    it('revokes a family when a token is reused', async () => {
      mocks.hashRefreshToken.mockReturnValue(
        'c'.repeat(64),
      )

      mocks.sessionFindOne.mockResolvedValue({
        _id: 'revoked-session-id',
        userId: {
          toString: () => 'user-id',
        },
        familyId,
        revokedAt: new Date(),
        expiresAt: new Date(
          Date.now() + 60 * 60 * 1000,
        ),
      })

      mocks.sessionUpdateMany.mockResolvedValue({
        acknowledged: true,
      })

      await expect(
        rotateRefreshSession(
          'reused-refresh-token',
        ),
      ).rejects.toMatchObject({
        name: 'AppError',
        statusCode: 401,
        code: 'INVALID_REFRESH_TOKEN',
      })

      expect(
        mocks.sessionUpdateMany,
      ).toHaveBeenCalledWith(
        {
          familyId,
          revokedAt: null,
        },
        {
          $set: {
            revokedAt: expect.any(Date),
            revocationReason:
              'reuse_detected',
          },
        },
      )

      expect(
        mocks.sessionCreate,
      ).not.toHaveBeenCalled()
    })

    it('rejects an expired refresh session', async () => {
      mocks.hashRefreshToken.mockReturnValue(
        'd'.repeat(64),
      )

      mocks.sessionFindOne.mockResolvedValue({
        _id: 'expired-session-id',
        userId: {
          toString: () => 'user-id',
        },
        familyId,
        revokedAt: null,
        expiresAt: new Date(
          Date.now() - 60 * 1000,
        ),
      })

      await expect(
        rotateRefreshSession(
          'expired-refresh-token',
        ),
      ).rejects.toMatchObject({
        name: 'AppError',
        statusCode: 401,
        code: 'INVALID_REFRESH_TOKEN',
      })

      expect(
        mocks.sessionFindOneAndUpdate,
      ).not.toHaveBeenCalled()

      expect(
        mocks.sessionCreate,
      ).not.toHaveBeenCalled()
    })

    it('revokes a refresh session during logout', async () => {
      mocks.hashRefreshToken.mockReturnValue(
        'e'.repeat(64),
      )

      mocks.sessionFindOneAndUpdate.mockResolvedValue({
        acknowledged: true,
      })

      await revokeRefreshSession('refresh-token')

      expect(
        mocks.sessionFindOneAndUpdate,
      ).toHaveBeenCalledWith(
        {
          refreshTokenHash: 'e'.repeat(64),
          revokedAt: null,
        },
        {
          $set: {
            revokedAt: expect.any(Date),
            revocationReason: 'logout',
            lastUsedAt: expect.any(Date),
          },
        },
      )
    })
  })
