import {
    describe,
    expect,
    it,
    vi,
  } from 'vitest'
  import {
    createChatRateLimiter,
  } from '../src/modules/chat/chatRateLimiter.js'

  function createRequest({
    userId = 'user-1',
    memoryId = 'memory-1',
  } = {}) {
    return {
      auth: {
        userId,
      },
      validatedParams: {
        memoryId,
      },
    }
  }

  function createResponse() {
    const headers = new Map()

    return {
      headers,

      setHeader: vi.fn(
        (name, value) => {
          headers.set(name, value)
        },
      ),
    }
  }

  function runMiddleware(
    middleware,
    req = createRequest(),
  ) {
    const res = createResponse()
    const next = vi.fn()

    middleware(req, res, next)

    return {
      res,
      next,
    }
  }

  describe('Chat rate limiter', () => {
    it('allows requests and exposes quota headers', () => {
      const middleware =
        createChatRateLimiter({
          windowMs: 60_000,
          maxRequests: 2,
          now: () => 1_000,
        })

      const first =
        runMiddleware(middleware)

      expect(first.next)
        .toHaveBeenCalledWith()

      expect(
        first.res.headers.get(
          'RateLimit-Limit',
        ),
      ).toBe(2)

      expect(
        first.res.headers.get(
          'RateLimit-Remaining',
        ),
      ).toBe(1)

      expect(
        first.res.headers.get(
          'RateLimit-Reset',
        ),
      ).toBe(61)

      const second =
        runMiddleware(middleware)

      expect(second.next)
        .toHaveBeenCalledWith()

      expect(
        second.res.headers.get(
          'RateLimit-Remaining',
        ),
      ).toBe(0)
    })

    it('blocks requests after the quota is exhausted', () => {
      const middleware =
        createChatRateLimiter({
          windowMs: 1_000,
          maxRequests: 2,
          now: () => 0,
        })

      runMiddleware(middleware)
      runMiddleware(middleware)

      const blocked =
        runMiddleware(middleware)

      const error =
        blocked.next.mock.calls[0][0]

      expect(error).toMatchObject({
        name: 'AppError',
        statusCode: 429,
        code: 'CHAT_RATE_LIMITED',
        message:
          'Too many chat messages. Please try again shortly.',
      })

      expect(
        blocked.res.headers.get(
          'RateLimit-Remaining',
        ),
      ).toBe(0)

      expect(
        blocked.res.headers.get(
          'Retry-After',
        ),
      ).toBe(1)
    })

    it('allows requests again after the window resets', () => {
      let currentTime = 0

      const middleware =
        createChatRateLimiter({
          windowMs: 1_000,
          maxRequests: 1,
          now: () => currentTime,
        })

      const first =
        runMiddleware(middleware)

      expect(first.next)
        .toHaveBeenCalledWith()

      const blocked =
        runMiddleware(middleware)

      expect(
        blocked.next.mock.calls[0][0],
      ).toMatchObject({
        statusCode: 429,
        code: 'CHAT_RATE_LIMITED',
      })

      currentTime = 1_000

      const afterReset =
        runMiddleware(middleware)

      expect(afterReset.next)
        .toHaveBeenCalledWith()

      expect(
        afterReset.res.headers.get(
          'RateLimit-Remaining',
        ),
      ).toBe(0)
    })

    it('keeps separate quotas for users and memories', () => {
      const middleware =
        createChatRateLimiter({
          windowMs: 60_000,
          maxRequests: 1,
          now: () => 0,
        })

      const firstUserFirstMemory =
        runMiddleware(
          middleware,
          createRequest({
            userId: 'user-1',
            memoryId: 'memory-1',
          }),
        )

      const secondUserFirstMemory =
        runMiddleware(
          middleware,
          createRequest({
            userId: 'user-2',
            memoryId: 'memory-1',
          }),
        )

      const firstUserSecondMemory =
        runMiddleware(
          middleware,
          createRequest({
            userId: 'user-1',
            memoryId: 'memory-2',
          }),
        )

      expect(firstUserFirstMemory.next)
        .toHaveBeenCalledWith()

      expect(secondUserFirstMemory.next)
        .toHaveBeenCalledWith()

      expect(firstUserSecondMemory.next)
        .toHaveBeenCalledWith()

      const repeatedRequest =
        runMiddleware(
          middleware,
          createRequest({
            userId: 'user-1',
            memoryId: 'memory-1',
          }),
        )

      expect(
        repeatedRequest.next
          .mock.calls[0][0],
      ).toMatchObject({
        statusCode: 429,
        code: 'CHAT_RATE_LIMITED',
      })
    })

    it('fails closed when authentication or validated parameters are missing', () => {
      const middleware =
        createChatRateLimiter()

      const missingAuthentication =
        runMiddleware(
          middleware,
          {
            auth: null,
            validatedParams: {
              memoryId: 'memory-1',
            },
          },
        )

      expect(
        missingAuthentication.next
          .mock.calls[0][0],
      ).toMatchObject({
        message:
          'Chat rate limiter requires authenticated user and validated memory identifiers.',
      })

      const missingMemory =
        runMiddleware(
          middleware,
          {
            auth: {
              userId: 'user-1',
            },
            validatedParams: {},
          },
        )

      expect(
        missingMemory.next
          .mock.calls[0][0],
      ).toMatchObject({
        message:
          'Chat rate limiter requires authenticated user and validated memory identifiers.',
      })
    })

    it('rejects invalid configuration and clock values', () => {
      expect(() =>
        createChatRateLimiter({
          windowMs: 0,
        }),
      ).toThrow(
        'Rate-limit window must be a positive integer.',
      )

      expect(() =>
        createChatRateLimiter({
          maxRequests: 0,
        }),
      ).toThrow(
        'Rate-limit maximum requests must be a positive integer.',
      )

      expect(() =>
        createChatRateLimiter({
          maxBuckets: 0,
        }),
      ).toThrow(
        'Rate-limit maximum buckets must be a positive integer.',
      )

      expect(() =>
        createChatRateLimiter({
          now: null,
        }),
      ).toThrow(
        'Rate-limit clock must be a function.',
      )

      const invalidClockMiddleware =
        createChatRateLimiter({
          now: () => Number.NaN,
        })

      const result =
        runMiddleware(
          invalidClockMiddleware,
        )

      expect(
        result.next.mock.calls[0][0],
      ).toMatchObject({
        name: 'TypeError',
        message:
          'Rate-limit clock returned an invalid time.',
      })
    })
  })
