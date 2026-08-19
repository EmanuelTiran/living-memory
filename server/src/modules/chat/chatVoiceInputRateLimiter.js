import { AppError } from '../../errors/AppError.js'
import {
  createFixedWindowRateLimiter,
} from '../../middleware/createFixedWindowRateLimiter.js'

export const CHAT_VOICE_INPUT_RATE_LIMIT_WINDOW_MS =
  60_000

export const CHAT_VOICE_INPUT_RATE_LIMIT_MAX_REQUESTS =
  6

function resolveRateLimitKey(req) {
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
      'Chat voice-input rate limiter requires authenticated user and memory identifiers.',
    )
  }

  return `${userId}:${memoryId}`
}

function createRateLimitError() {
  return new AppError(
    'Too many chat voice-input requests. Please try again shortly.',
    {
      statusCode: 429,
      code:
        'CHAT_VOICE_INPUT_RATE_LIMITED',
    },
  )
}

export const chatVoiceInputRateLimiter =
  createFixedWindowRateLimiter({
    windowMs:
      CHAT_VOICE_INPUT_RATE_LIMIT_WINDOW_MS,
    maxRequests:
      CHAT_VOICE_INPUT_RATE_LIMIT_MAX_REQUESTS,
    resolveKey:
      resolveRateLimitKey,
    createRateLimitError,
  })
