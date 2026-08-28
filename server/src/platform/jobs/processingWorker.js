import { randomUUID } from 'node:crypto'
import { logger } from '../../utils/logger.js'
import {
  claimNextProcessingJob,
  completeProcessingJob,
  failProcessingJob,
  getProcessingJobId,
  recoverStaleProcessingJobs,
  updateProcessingJobProgress,
} from './processingJobService.js'

const DEFAULT_POLL_INTERVAL_MS = 1_500
const DEFAULT_LEASE_MS = 2 * 60 * 1000
const DEFAULT_MAX_JOBS_PER_TICK = 3

function validateHandlers(handlers) {
  if (
    !handlers ||
    typeof handlers !== 'object' ||
    Array.isArray(handlers)
  ) {
    throw new TypeError(
      'Processing worker handlers are invalid.',
    )
  }

  const entries = Object.entries(handlers)

  if (entries.length === 0) {
    throw new TypeError(
      'Processing worker requires at least one handler.',
    )
  }

  for (const [jobType, handler] of entries) {
    if (
      typeof jobType !== 'string' ||
      typeof handler?.run !== 'function'
    ) {
      throw new TypeError(
        'Processing worker handler is invalid.',
      )
    }
  }
}

function validatePositiveInteger(
  label,
  value,
  maximum,
) {
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > maximum
  ) {
    throw new TypeError(
      `${label} is invalid.`,
    )
  }
}

export function createProcessingWorker({
  handlers,
  workerId = `worker-${randomUUID()}`,
  pollIntervalMs =
    DEFAULT_POLL_INTERVAL_MS,
  leaseMs = DEFAULT_LEASE_MS,
  maxJobsPerTick =
    DEFAULT_MAX_JOBS_PER_TICK,
  service = {
    claimNextProcessingJob,
    completeProcessingJob,
    failProcessingJob,
    recoverStaleProcessingJobs,
    updateProcessingJobProgress,
  },
} = {}) {
  validateHandlers(handlers)
  validatePositiveInteger(
    'Processing worker poll interval',
    pollIntervalMs,
    60_000,
  )
  validatePositiveInteger(
    'Processing worker lease',
    leaseMs,
    15 * 60 * 1000,
  )
  validatePositiveInteger(
    'Processing worker batch size',
    maxJobsPerTick,
    20,
  )

  if (
    typeof workerId !== 'string' ||
    workerId.length < 8 ||
    workerId.length > 120
  ) {
    throw new TypeError(
      'Processing worker ID is invalid.',
    )
  }

  const jobTypes = Object.keys(handlers)
  let isRunning = false
  let timer = null
  let currentTick = null

  async function executeJob(job) {
    const jobId = getProcessingJobId(job)
    const handler = handlers[job.jobType]

    try {
      const resultSummary =
        await handler.run({
          job,
          updateProgress(progress) {
            return service
              .updateProcessingJobProgress({
                jobId,
                workerId,
                progress,
              })
          },
        })

      return service.completeProcessingJob({
        jobId,
        workerId,
        resultSummary,
      })
    } catch (error) {
      const settledJob =
        await service.failProcessingJob({
          jobId,
          workerId,
          error,
        })

      if (
        typeof handler.onFailure ===
        'function'
      ) {
        try {
          await handler.onFailure({
            job,
            settledJob,
            error,
          })
        } catch (handlerError) {
          logger.error(
            'Processing job failure hook failed',
            {
              jobType: job.jobType,
              errorName:
                handlerError?.name ??
                'Error',
              errorCode:
                handlerError?.code ??
                null,
            },
          )
        }
      }

      return settledJob
    }
  }

  async function runOnce() {
    await service
      .recoverStaleProcessingJobs(
        new Date(),
      )

    let processedCount = 0

    while (
      processedCount < maxJobsPerTick
    ) {
      const job =
        await service
          .claimNextProcessingJob({
            workerId,
            jobTypes,
            leaseMs,
            now: new Date(),
          })

      if (!job) {
        break
      }

      await executeJob(job)
      processedCount += 1
    }

    return processedCount
  }

  function scheduleNextTick() {
    if (!isRunning) {
      return
    }

    timer = setTimeout(() => {
      currentTick = runOnce()
        .catch((error) => {
          logger.error(
            'Processing worker tick failed',
            {
              errorName:
                error?.name ?? 'Error',
              errorCode:
                error?.code ?? null,
            },
          )
        })
        .finally(() => {
          currentTick = null
          scheduleNextTick()
        })
    }, pollIntervalMs)

    timer.unref?.()
  }

  function start() {
    if (isRunning) {
      return
    }

    isRunning = true
    currentTick = runOnce()
      .catch((error) => {
        logger.error(
          'Processing worker startup tick failed',
          {
            errorName:
              error?.name ?? 'Error',
            errorCode:
              error?.code ?? null,
          },
        )
      })
      .finally(() => {
        currentTick = null
        scheduleNextTick()
      })
  }

  async function stop() {
    isRunning = false

    if (timer) {
      clearTimeout(timer)
      timer = null
    }

    if (currentTick) {
      await currentTick
    }
  }

  return Object.freeze({
    runOnce,
    start,
    stop,
  })
}
