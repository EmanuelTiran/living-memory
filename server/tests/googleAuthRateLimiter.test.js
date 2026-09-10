import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  googleAuthenticationRateLimiter,
  googleRedirectStateCreationRateLimiter,
  googleRedirectStateResolutionRateLimiter,
} from '../src/modules/auth/authRateLimiters.js'

function runRateLimiter(rateLimiter, request) {
  const response = {
    setHeader() {},
  }

  return new Promise((resolve) => {
    rateLimiter(
      request,
      response,
      (error) => resolve(error),
    )
  })
}

describe('Google authentication rate limiter', () => {
  it('limits repeated credential attempts by IP', async () => {
    const request = {
      ip: '203.0.113.88',
    }

    for (let index = 0; index < 20; index += 1) {
      await expect(
        runRateLimiter(
          googleAuthenticationRateLimiter,
          request,
        ),
      ).resolves.toBeUndefined()
    }

    await expect(
      runRateLimiter(
        googleAuthenticationRateLimiter,
        request,
      ),
    ).resolves.toMatchObject({
      statusCode: 429,
      code: 'AUTH_RATE_LIMITED',
    })
  })

  it('keeps state creation and recovery in separate buckets', async () => {
    const request = {
      ip: '203.0.113.89',
    }

    for (let index = 0; index < 30; index += 1) {
      await expect(
        runRateLimiter(
          googleRedirectStateCreationRateLimiter,
          request,
        ),
      ).resolves.toBeUndefined()
    }

    await expect(
      runRateLimiter(
        googleRedirectStateCreationRateLimiter,
        request,
      ),
    ).resolves.toMatchObject({
      code: 'AUTH_RATE_LIMITED',
    })
    await expect(
      runRateLimiter(
        googleRedirectStateResolutionRateLimiter,
        request,
      ),
    ).resolves.toBeUndefined()
  })
})
