import { AppError } from '../../errors/AppError.js'
import { createHash } from 'node:crypto'
import {
  createFixedWindowRateLimiter,
} from '../../middleware/createFixedWindowRateLimiter.js'

const FIFTEEN_MINUTES_MS =
  15 * 60 * 1000

function createAuthRateLimitError() {
  return new AppError(
    'Too many authentication attempts. Try again later.',
    {
      statusCode: 429,
      code: 'AUTH_RATE_LIMITED',
    },
  )
}

function resolveRequestIp(req) {
  return req.ip ??
    req.socket?.remoteAddress ??
    'unknown'
}

function createAuthRateLimiter(
  operation,
  maxRequests,
) {
  return createFixedWindowRateLimiter({
    windowMs: FIFTEEN_MINUTES_MS,
    maxRequests,
    resolveKey: (req) =>
      `${operation}:${resolveRequestIp(req)}`,
    createRateLimitError:
      createAuthRateLimitError,
  })
}

function resolveEmailHash(req) {
  const email =
    typeof req.validatedBody?.email === 'string'
      ? req.validatedBody.email
      : 'invalid'

  return createHash('sha256')
    .update(email, 'utf8')
    .digest('hex')
}

export const registrationRateLimiter =
  createAuthRateLimiter('register', 10)

export const loginRateLimiter =
  createAuthRateLimiter('login', 20)

export const googleAuthenticationRateLimiter =
  createAuthRateLimiter('google', 20)

export const googleRedirectStateCreationRateLimiter =
  createAuthRateLimiter(
    'google-state-create',
    30,
  )

export const googleRedirectStateResolutionRateLimiter =
  createAuthRateLimiter(
    'google-state-resolve',
    30,
  )

export const refreshRateLimiter =
  createAuthRateLimiter('refresh', 120)

export const forgotPasswordRateLimiter =
  createAuthRateLimiter(
    'forgot-password',
    10,
  )

export const forgotPasswordEmailRateLimiter =
  createFixedWindowRateLimiter({
    windowMs: FIFTEEN_MINUTES_MS,
    maxRequests: 3,
    resolveKey: (req) =>
      `forgot-password-email:${resolveEmailHash(req)}`,
    createRateLimitError:
      createAuthRateLimitError,
  })

export const resetPasswordRateLimiter =
  createAuthRateLimiter(
    'reset-password',
    10,
  )
