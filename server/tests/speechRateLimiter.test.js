import {
    describe,
    expect,
    it,
    vi,
  } from 'vitest'
  import {
    createSpeechRateLimiter,
  } from '../src/modules/voice/speechRateLimiter.js'

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

  describe('Speech rate limiter', () => {
    it('blocks speech generation after its dedicated quota is exhausted', () => {
      const middleware =
        createSpeechRateLimiter({
          windowMs: 60_000,
          maxRequests: 2,
          now: () => 1_000,
        })

      const first =
        runMiddleware(middleware)

      const second =
        runMiddleware(middleware)

      expect(first.next)
        .toHaveBeenCalledWith()

      expect(second.next)
        .toHaveBeenCalledWith()

      const blocked =
        runMiddleware(middleware)

      expect(
        blocked.next.mock.calls[0][0],
      ).toMatchObject({
        name: 'AppError',
        statusCode: 429,
        code:
          'AI_SPEECH_RATE_LIMITED',
        message:
          'Too many speech requests. Please try again shortly.',
      })

      expect(
        blocked.res.headers.get(
          'RateLimit-Limit',
        ),
      ).toBe(2)

      expect(
        blocked.res.headers.get(
          'RateLimit-Remaining',
        ),
      ).toBe(0)

      expect(
        blocked.res.headers.get(
          'Retry-After',
        ),
      ).toBe(60)
    })

    it('keeps separate quotas for users and memories', () => {
      const middleware =
        createSpeechRateLimiter({
          maxRequests: 1,
          now: () => 0,
        })

      const first =
        runMiddleware(
          middleware,
          createRequest({
            userId: 'user-1',
            memoryId: 'memory-1',
          }),
        )

      const anotherUser =
        runMiddleware(
          middleware,
          createRequest({
            userId: 'user-2',
            memoryId: 'memory-1',
          }),
        )

      const anotherMemory =
        runMiddleware(
          middleware,
          createRequest({
            userId: 'user-1',
            memoryId: 'memory-2',
          }),
        )

      expect(first.next)
        .toHaveBeenCalledWith()

      expect(anotherUser.next)
        .toHaveBeenCalledWith()

      expect(anotherMemory.next)
        .toHaveBeenCalledWith()

      const repeated =
        runMiddleware(
          middleware,
          createRequest({
            userId: 'user-1',
            memoryId: 'memory-1',
          }),
        )

      expect(
        repeated.next.mock.calls[0][0],
      ).toMatchObject({
        statusCode: 429,
        code:
          'AI_SPEECH_RATE_LIMITED',
      })
    })

    it('fails closed when request identity is unavailable', () => {
      const middleware =
        createSpeechRateLimiter()

      const result =
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
        result.next.mock.calls[0][0],
      ).toMatchObject({
        message:
          'Speech rate limiter requires authenticated user and validated memory identifiers.',
      })
    })
  })
