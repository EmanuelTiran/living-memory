import {
    afterEach,
    describe,
    expect,
    it,
    vi,
  } from 'vitest'

  const mocks = vi.hoisted(() => ({
    verifyAccessToken: vi.fn(),
  }))

  vi.mock('../src/modules/auth/tokens.js', () => ({
    verifyAccessToken: mocks.verifyAccessToken,
  }))

  import { requireAuth } from '../src/middleware/requireAuth.js'

  function createRequest(authorization) {
    return {
      get: vi.fn((headerName) => {
        if (headerName === 'authorization') {
          return authorization
        }

        return undefined
      }),
    }
  }

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('requireAuth middleware', () => {
    it('accepts a valid Bearer token', async () => {
      const authentication = {
        userId: 'user-id',
        systemRole: 'user',
        tokenId: 'token-id',
        expiresAt: new Date(
          Date.now() + 15 * 60 * 1000,
        ),
      }

      mocks.verifyAccessToken.mockResolvedValue(
        authentication,
      )

      const req = createRequest(
        'Bearer valid-access-token',
      )

      const next = vi.fn()

      await requireAuth(req, {}, next)

      expect(
        mocks.verifyAccessToken,
      ).toHaveBeenCalledWith(
        'valid-access-token',
      )

      expect(req.auth).toEqual(authentication)
      expect(next).toHaveBeenCalledWith()
    })

    it('rejects a missing Authorization header', async () => {
      const req = createRequest(undefined)
      const next = vi.fn()

      await requireAuth(req, {}, next)

      expect(
        mocks.verifyAccessToken,
      ).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AppError',
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
        }),
      )
    })

    it('rejects a malformed Authorization header', async () => {
      const req = createRequest(
        'Basic invalid-access-token',
      )

      const next = vi.fn()

      await requireAuth(req, {}, next)

      expect(
        mocks.verifyAccessToken,
      ).not.toHaveBeenCalled()

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AppError',
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
        }),
      )
    })

    it('rejects an invalid or expired access token', async () => {
      mocks.verifyAccessToken.mockRejectedValue(
        new Error('JWT verification failed'),
      )

      const req = createRequest(
        'Bearer invalid-access-token',
      )

      const next = vi.fn()

      await requireAuth(req, {}, next)

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AppError',
          statusCode: 401,
          code: 'AUTHENTICATION_REQUIRED',
        }),
      )

      expect(req).not.toHaveProperty('auth')
    })
  })
