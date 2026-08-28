import { AppError } from '../../errors/AppError.js'
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

export const registrationRateLimiter =
  createAuthRateLimiter('register', 10)

export const loginRateLimiter =
  createAuthRateLimiter('login', 20)

export const refreshRateLimiter =
  createAuthRateLimiter('refresh', 120)
