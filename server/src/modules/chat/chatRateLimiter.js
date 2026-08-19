import { AppError } from '../../errors/AppError.js'
import {
  createFixedWindowRateLimiter,
} from '../../middleware/createFixedWindowRateLimiter.js'

export const CHAT_RATE_LIMIT_WINDOW_MS =
  60_000

export const CHAT_RATE_LIMIT_MAX_REQUESTS =
  10

const CHAT_RATE_LIMIT_MAX_BUCKETS =
  10_000

const CHAT_RATE_LIMIT_CLEANUP_INTERVAL =
  100

function resolveChatRateLimitKey(req) {
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
      'Chat rate limiter requires authenticated user and validated memory identifiers.',
    )
  }

  return `${userId}:${memoryId}`
}

function createChatRateLimitError() {
  return new AppError(
    'Too many chat messages. Please try again shortly.',
    {
      statusCode: 429,
      code: 'CHAT_RATE_LIMITED',
    },
  )
}

export function createChatRateLimiter({
  windowMs =
    CHAT_RATE_LIMIT_WINDOW_MS,
  maxRequests =
    CHAT_RATE_LIMIT_MAX_REQUESTS,
  maxBuckets =
    CHAT_RATE_LIMIT_MAX_BUCKETS,
  now = Date.now,
} = {}) {
  return createFixedWindowRateLimiter({
    windowMs,
    maxRequests,
    maxBuckets,
    cleanupInterval:
      CHAT_RATE_LIMIT_CLEANUP_INTERVAL,
    now,
    resolveKey:
      resolveChatRateLimitKey,
    createRateLimitError:
      createChatRateLimitError,
  })
}

export const chatMessageRateLimiter =
  createChatRateLimiter()
