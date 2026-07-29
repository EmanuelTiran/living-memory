import { AppError } from '../../errors/AppError.js'

export const CHAT_RATE_LIMIT_WINDOW_MS =
  60_000

export const CHAT_RATE_LIMIT_MAX_REQUESTS =
  10

const CHAT_RATE_LIMIT_MAX_BUCKETS =
  10_000

const CHAT_RATE_LIMIT_CLEANUP_INTERVAL =
  100

function validatePositiveInteger(
  name,
  value,
) {
  if (
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new TypeError(
      `${name} must be a positive integer.`,
    )
  }
}

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
      'Chat rate limiter requires authenticated user and validated memory identifiers.',
    )
  }

  return `${userId}:${memoryId}`
}

function createRateLimitError() {
  return new AppError(
    'Too many chat messages. Please try again shortly.',
    {
      statusCode: 429,
      code: 'CHAT_RATE_LIMITED',
    },
  )
}

function setRateLimitHeaders(
  res,
  {
    limit,
    remaining,
    resetAt,
  },
) {
  res.setHeader(
    'RateLimit-Limit',
    limit,
  )

  res.setHeader(
    'RateLimit-Remaining',
    remaining,
  )

  res.setHeader(
    'RateLimit-Reset',
    Math.ceil(resetAt / 1000),
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
  validatePositiveInteger(
    'Rate-limit window',
    windowMs,
  )

  validatePositiveInteger(
    'Rate-limit maximum requests',
    maxRequests,
  )

  validatePositiveInteger(
    'Rate-limit maximum buckets',
    maxBuckets,
  )

  if (typeof now !== 'function') {
    throw new TypeError(
      'Rate-limit clock must be a function.',
    )
  }

  const buckets = new Map()
  let processedRequests = 0

  function removeExpiredBuckets(
    currentTime,
  ) {
    for (
      const [
        key,
        bucket,
      ] of buckets
    ) {
      if (
        bucket.resetAt <=
        currentTime
      ) {
        buckets.delete(key)
      }
    }
  }

  function runScheduledCleanup(
    currentTime,
  ) {
    processedRequests += 1

    if (
      processedRequests %
        CHAT_RATE_LIMIT_CLEANUP_INTERVAL ===
      0
    ) {
      removeExpiredBuckets(
        currentTime,
      )
    }
  }

  function ensureBucketCapacity(
    currentTime,
  ) {
    if (buckets.size < maxBuckets) {
      return
    }

    removeExpiredBuckets(currentTime)

    while (
      buckets.size >= maxBuckets
    ) {
      const oldestKey =
        buckets.keys().next().value

      if (oldestKey === undefined) {
        break
      }

      buckets.delete(oldestKey)
    }
  }

  return function chatRateLimiter(
    req,
    res,
    next,
  ) {
    let key
    let currentTime

    try {
      key = resolveRateLimitKey(req)
      currentTime = now()

      if (!Number.isFinite(currentTime)) {
        throw new TypeError(
          'Rate-limit clock returned an invalid time.',
        )
      }
    } catch (error) {
      next(error)
      return
    }

    runScheduledCleanup(currentTime)

    let bucket = buckets.get(key)

    if (
      bucket &&
      bucket.resetAt <= currentTime
    ) {
      buckets.delete(key)
      bucket = undefined
    }

    if (!bucket) {
      ensureBucketCapacity(
        currentTime,
      )

      bucket = {
        count: 0,
        resetAt:
          currentTime + windowMs,
      }

      buckets.set(key, bucket)
    }

    if (
      bucket.count >= maxRequests
    ) {
      const retryAfterSeconds =
        Math.max(
          1,
          Math.ceil(
            (
              bucket.resetAt -
              currentTime
            ) / 1000,
          ),
        )

      setRateLimitHeaders(res, {
        limit: maxRequests,
        remaining: 0,
        resetAt: bucket.resetAt,
      })

      res.setHeader(
        'Retry-After',
        retryAfterSeconds,
      )

      next(createRateLimitError())
      return
    }

    bucket.count += 1

    setRateLimitHeaders(res, {
      limit: maxRequests,
      remaining:
        maxRequests - bucket.count,
      resetAt: bucket.resetAt,
    })

    next()
  }
}

export const chatMessageRateLimiter =
  createChatRateLimiter()