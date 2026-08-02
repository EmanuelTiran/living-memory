import { AppError } from '../../errors/AppError.js'
import {
  createFixedWindowRateLimiter,
} from '../../middleware/createFixedWindowRateLimiter.js'

export const SPEECH_RATE_LIMIT_WINDOW_MS =
  60_000

export const SPEECH_RATE_LIMIT_MAX_REQUESTS =
  6

const SPEECH_RATE_LIMIT_MAX_BUCKETS =
  10_000

const SPEECH_RATE_LIMIT_CLEANUP_INTERVAL =
  100

function resolveSpeechRateLimitKey(req) {
  const userId = req.auth?.userId
  const memoryId =
    req.validatedParams?.memoryId

  if (
    typeof userId !== 'string' ||
    userId.length === 0 ||
    typeof memoryId !== 'string' ||
    memoryId.length === 0
  ) {
    throw new Error(
      'Speech rate limiter requires authenticated user and validated memory identifiers.',
    )
  }

  return `${userId}:${memoryId}`
}

function createSpeechRateLimitError() {
  return new AppError(
    'Too many speech requests. Please try again shortly.',
    {
      statusCode: 429,
      code:
        'AI_SPEECH_RATE_LIMITED',
    },
  )
}

export function createSpeechRateLimiter({
  windowMs =
    SPEECH_RATE_LIMIT_WINDOW_MS,
  maxRequests =
    SPEECH_RATE_LIMIT_MAX_REQUESTS,
  maxBuckets =
    SPEECH_RATE_LIMIT_MAX_BUCKETS,
  now = Date.now,
} = {}) {
  return createFixedWindowRateLimiter({
    windowMs,
    maxRequests,
    maxBuckets,
    cleanupInterval:
      SPEECH_RATE_LIMIT_CLEANUP_INTERVAL,
    now,
    resolveKey:
      resolveSpeechRateLimitKey,
    createRateLimitError:
      createSpeechRateLimitError,
  })
}

export const chatSpeechRateLimiter =
  createSpeechRateLimiter()
