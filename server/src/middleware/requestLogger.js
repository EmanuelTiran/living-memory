import { performance } from 'node:perf_hooks'
import { logger } from '../utils/logger.js'

export function requestLogger(req, res, next) {
  const startedAt = performance.now()

  res.once('finish', () => {
    logger.info('HTTP request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Number(
        (performance.now() - startedAt).toFixed(2),
      ),
    })
  })

  next()
}