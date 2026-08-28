import { AppError } from '../../errors/AppError.js'
import ProcessingJob from './ProcessingJob.js'
import {
  claimProcessingJobSchema,
  enqueueProcessingJobSchema,
  processingJobLeaseSchema,
  processingJobProgressSchema,
} from './processingJobValidation.js'

const DEFAULT_RETRY_DELAY_MS = 5_000

function createJobStateChangedError() {
  return new AppError(
    'Processing job state changed before the operation completed.',
    {
      statusCode: 409,
      code:
        'PROCESSING_JOB_STATE_CHANGED',
    },
  )
}

function resolveJobId(job) {
  return (
    job?.id ??
    job?._id?.toString?.() ??
    ''
  )
}

function normalizeErrorCode(error) {
  const errorCode =
    typeof error?.code === 'string'
      ? error.code
      : ''

  if (
    /^[A-Z][A-Z0-9_]{2,99}$/.test(
      errorCode,
    )
  ) {
    return errorCode
  }

  return 'PROCESSING_JOB_FAILED'
}

function normalizeResultSummary(
  resultSummary,
) {
  if (
    resultSummary === undefined ||
    resultSummary === null
  ) {
    return null
  }

  let serialized

  try {
    serialized = JSON.stringify(
      resultSummary,
    )
  } catch {
    throw new TypeError(
      'Processing job result must be serializable.',
    )
  }

  if (
    Buffer.byteLength(
      serialized,
      'utf8',
    ) > 8 * 1024
  ) {
    throw new TypeError(
      'Processing job result is too large.',
    )
  }

  return resultSummary
}

export async function enqueueProcessingJob(
  input,
) {
  const validated =
    enqueueProcessingJobSchema.parse(
      input,
    )

  const job =
    await ProcessingJob.findOneAndUpdate(
      {
        jobType:
          validated.jobType,
        idempotencyKey:
          validated.idempotencyKey,
      },
      {
        $setOnInsert: {
          memoryId:
            validated.memoryId,
          jobType:
            validated.jobType,
          idempotencyKey:
            validated.idempotencyKey,
          resourceType:
            validated.resourceType,
          resourceId:
            validated.resourceId,
          payload:
            validated.payload,
          status: 'queued',
          progress: 0,
          attemptCount: 0,
          maxAttempts:
            validated.maxAttempts,
          nextRunAt:
            validated.availableAt ??
            new Date(),
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    )

  return job
}

export async function claimNextProcessingJob(
  input,
) {
  const validated =
    claimProcessingJobSchema.parse(
      input,
    )

  const leaseExpiresAt = new Date(
    validated.now.getTime() +
      validated.leaseMs,
  )

  return ProcessingJob.findOneAndUpdate(
    {
      jobType: {
        $in: validated.jobTypes,
      },
      status: 'queued',
      nextRunAt: {
        $lte: validated.now,
      },
    },
    {
      $set: {
        status: 'processing',
        workerId:
          validated.workerId,
        leaseExpiresAt,
        startedAt:
          validated.now,
        lastErrorCode: null,
      },
      $inc: {
        attemptCount: 1,
      },
    },
    {
      sort: {
        nextRunAt: 1,
        createdAt: 1,
        _id: 1,
      },
      returnDocument: 'after',
      runValidators: true,
    },
  ).select(
    '+payload +workerId +leaseExpiresAt',
  )
}

export async function updateProcessingJobProgress(
  input,
) {
  const validated =
    processingJobProgressSchema.parse(
      input,
    )

  const job =
    await ProcessingJob.findOneAndUpdate(
      {
        _id: validated.jobId,
        status: 'processing',
        workerId:
          validated.workerId,
      },
      {
        $max: {
          progress:
            validated.progress,
        },
      },
      {
        returnDocument: 'after',
        runValidators: true,
      },
    )

  if (!job) {
    throw createJobStateChangedError()
  }

  return job
}

export async function completeProcessingJob(
  input,
) {
  const validated =
    processingJobLeaseSchema.parse({
      jobId: input?.jobId,
      workerId: input?.workerId,
    })

  const completedAt =
    input?.completedAt ?? new Date()
  const resultSummary =
    normalizeResultSummary(
      input?.resultSummary,
    )

  const job =
    await ProcessingJob.findOneAndUpdate(
      {
        _id: validated.jobId,
        status: 'processing',
        workerId:
          validated.workerId,
      },
      {
        $set: {
          status: 'completed',
          progress: 100,
          completedAt,
          resultSummary,
          lastErrorCode: null,
        },
        $unset: {
          workerId: 1,
          leaseExpiresAt: 1,
        },
      },
      {
        returnDocument: 'after',
        runValidators: true,
      },
    )

  if (!job) {
    throw createJobStateChangedError()
  }

  return job
}

export async function failProcessingJob(
  input,
) {
  const validated =
    processingJobLeaseSchema.parse({
      jobId: input?.jobId,
      workerId: input?.workerId,
    })

  const now = input?.now ?? new Date()
  const retryDelayMs =
    input?.retryDelayMs ??
    DEFAULT_RETRY_DELAY_MS

  if (
    !Number.isInteger(retryDelayMs) ||
    retryDelayMs < 0 ||
    retryDelayMs > 60 * 60 * 1000
  ) {
    throw new TypeError(
      'Processing job retry delay is invalid.',
    )
  }

  const currentJob =
    await ProcessingJob.findOne({
      _id: validated.jobId,
      status: 'processing',
      workerId:
        validated.workerId,
    }).select(
      '+workerId attemptCount maxAttempts',
    )

  if (!currentJob) {
    throw createJobStateChangedError()
  }

  const isTerminal =
    currentJob.attemptCount >=
    currentJob.maxAttempts
  const errorCode =
    normalizeErrorCode(input?.error)
  const exponent = Math.max(
    0,
    currentJob.attemptCount - 1,
  )
  const nextRunAt = new Date(
    now.getTime() +
      retryDelayMs * 2 ** exponent,
  )

  const job =
    await ProcessingJob.findOneAndUpdate(
      {
        _id: validated.jobId,
        status: 'processing',
        workerId:
          validated.workerId,
        attemptCount:
          currentJob.attemptCount,
      },
      {
        $set: {
          status:
            isTerminal
              ? 'failed'
              : 'queued',
          nextRunAt,
          completedAt:
            isTerminal ? now : null,
          lastErrorCode:
            errorCode,
        },
        $unset: {
          workerId: 1,
          leaseExpiresAt: 1,
        },
      },
      {
        returnDocument: 'after',
        runValidators: true,
      },
    )

  if (!job) {
    throw createJobStateChangedError()
  }

  return job
}

export async function recoverStaleProcessingJobs(
  now = new Date(),
) {
  if (!(now instanceof Date)) {
    throw new TypeError(
      'Processing recovery time must be a Date.',
    )
  }

  const terminalResult =
    await ProcessingJob.updateMany(
      {
        status: 'processing',
        leaseExpiresAt: {
          $lte: now,
        },
        $expr: {
          $gte: [
            '$attemptCount',
            '$maxAttempts',
          ],
        },
      },
      {
        $set: {
          status: 'failed',
          completedAt: now,
          lastErrorCode:
            'PROCESSING_JOB_LEASE_EXPIRED',
        },
        $unset: {
          workerId: 1,
          leaseExpiresAt: 1,
        },
      },
      {
        runValidators: true,
      },
    )

  const retryResult =
    await ProcessingJob.updateMany(
      {
        status: 'processing',
        leaseExpiresAt: {
          $lte: now,
        },
        $expr: {
          $lt: [
            '$attemptCount',
            '$maxAttempts',
          ],
        },
      },
      {
        $set: {
          status: 'queued',
          nextRunAt: now,
          lastErrorCode:
            'PROCESSING_JOB_LEASE_EXPIRED',
        },
        $unset: {
          workerId: 1,
          leaseExpiresAt: 1,
        },
      },
      {
        runValidators: true,
      },
    )

  return (
    terminalResult.modifiedCount +
    retryResult.modifiedCount
  )
}

export async function cancelProcessingJob(
  jobId,
) {
  const validated =
    processingJobLeaseSchema.shape.jobId
      .parse(jobId)
  const completedAt = new Date()

  return ProcessingJob.findOneAndUpdate(
    {
      _id: validated,
      status: {
        $in: [
          'queued',
          'processing',
        ],
      },
    },
    {
      $set: {
        status: 'cancelled',
        completedAt,
        lastErrorCode: null,
      },
      $unset: {
        workerId: 1,
        leaseExpiresAt: 1,
      },
    },
    {
      returnDocument: 'after',
      runValidators: true,
    },
  )
}

export function getProcessingJobId(job) {
  const jobId = resolveJobId(job)

  if (!jobId) {
    throw new TypeError(
      'Processing job does not have an identifier.',
    )
  }

  return jobId
}
