import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  forgotPasswordEmailRateLimiter,
  resetPasswordRateLimiter,
} from '../src/modules/auth/authRateLimiters.js'

function runRateLimiter(
  rateLimiter,
  request,
) {
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

describe('Password reset rate limiters', () => {
  it('limits repeated reset emails to one address', async () => {
    const request = {
      validatedBody: {
        email:
          'mail-limit-test@example.com',
      },
    }

    for (let index = 0; index < 3; index += 1) {
      await expect(
        runRateLimiter(
          forgotPasswordEmailRateLimiter,
          request,
        ),
      ).resolves.toBeUndefined()
    }

    await expect(
      runRateLimiter(
        forgotPasswordEmailRateLimiter,
        request,
      ),
    ).resolves.toMatchObject({
      statusCode: 429,
      code: 'AUTH_RATE_LIMITED',
    })
  })

  it('limits repeated token consumption attempts by IP', async () => {
    const request = {
      ip: '203.0.113.45',
    }

    for (let index = 0; index < 10; index += 1) {
      await expect(
        runRateLimiter(
          resetPasswordRateLimiter,
          request,
        ),
      ).resolves.toBeUndefined()
    }

    await expect(
      runRateLimiter(
        resetPasswordRateLimiter,
        request,
      ),
    ).resolves.toMatchObject({
      statusCode: 429,
      code: 'AUTH_RATE_LIMITED',
    })
  })
})
