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

  export function createFixedWindowRateLimiter({
    windowMs,
    maxRequests,
    maxBuckets = 10_000,
    cleanupInterval = 100,
    now = Date.now,
    resolveKey,
    createRateLimitError,
  }) {
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

    validatePositiveInteger(
      'Rate-limit cleanup interval',
      cleanupInterval,
    )

    if (typeof now !== 'function') {
      throw new TypeError(
        'Rate-limit clock must be a function.',
      )
    }

    if (typeof resolveKey !== 'function') {
      throw new TypeError(
        'Rate-limit key resolver must be a function.',
      )
    }

    if (
      typeof createRateLimitError !==
      'function'
    ) {
      throw new TypeError(
        'Rate-limit error factory must be a function.',
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
          cleanupInterval ===
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

    return function fixedWindowRateLimiter(
      req,
      res,
      next,
    ) {
      let key
      let currentTime

      try {
        key = resolveKey(req)
        currentTime = now()

        if (
          typeof key !== 'string' ||
          key.length === 0
        ) {
          throw new TypeError(
            'Rate-limit key must be a non-empty string.',
          )
        }

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
