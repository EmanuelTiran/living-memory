import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { AppError } from '../../errors/AppError.js'

const JOB_TTL_MS = 15 * 60 * 1000
const MAX_JOB_COUNT = 20

const jobs = new Map()

function discardVideo(job) {
  if (Buffer.isBuffer(job?.videoBuffer)) {
    job.videoBuffer.fill(0)
  }
}

function removeJob(jobId) {
  const job = jobs.get(jobId)

  if (!job) {
    return
  }

  discardVideo(job)
  jobs.delete(jobId)
}

function cleanupExpiredJobs(now = Date.now()) {
  for (const [jobId, job] of jobs) {
    if (job.expiresAt <= now) {
      removeJob(jobId)
    }
  }
}

function createJobCapacityError() {
  return new AppError(
    'Too many avatar videos are being prepared. Please try again shortly.',
    {
      statusCode: 429,
      code: 'DID_JOB_CAPACITY_REACHED',
    },
  )
}

function createJobNotFoundError() {
  return new AppError(
    'The avatar video job was not found or has expired.',
    {
      statusCode: 404,
      code: 'DID_JOB_NOT_FOUND',
    },
  )
}

function enforceCapacity() {
  cleanupExpiredJobs()

  if (jobs.size < MAX_JOB_COUNT) {
    return
  }

  const removableJob = [...jobs.values()]
    .filter(
      (job) =>
        job.status !== 'processing',
    )
    .sort(
      (left, right) =>
        left.createdAt -
        right.createdAt,
    )[0]

  if (removableJob) {
    removeJob(removableJob.id)
  }

  if (jobs.size >= MAX_JOB_COUNT) {
    throw createJobCapacityError()
  }
}

function requireOwnedJob({
  jobId,
  userId,
  memoryId,
}) {
  cleanupExpiredJobs()

  const job = jobs.get(jobId)

  if (
    !job ||
    job.userId !== userId ||
    job.memoryId !== memoryId
  ) {
    throw createJobNotFoundError()
  }

  return job
}

export function createDIDAvatarJob({
  userId,
  memoryId,
  conversationId,
  messageId,
}) {
  enforceCapacity()

  const createdAt = Date.now()

  const job = {
    id: randomUUID(),
    userId,
    memoryId,
    conversationId,
    messageId,
    status: 'processing',
    errorCode: null,
    videoBuffer: null,
    byteLength: 0,
    createdAt,
    expiresAt:
      createdAt + JOB_TTL_MS,
  }

  jobs.set(job.id, job)

  return job.id
}

export function completeDIDAvatarJob(
  jobId,
  video,
) {
  const job = jobs.get(jobId)

  if (!job) {
    if (
      Buffer.isBuffer(
        video?.videoBuffer,
      )
    ) {
      video.videoBuffer.fill(0)
    }

    return
  }

  job.status = 'ready'
  job.videoBuffer = video.videoBuffer
  job.byteLength = video.byteLength
  job.errorCode = null
  job.expiresAt =
    Date.now() + JOB_TTL_MS
}

export function failDIDAvatarJob(
  jobId,
  error,
) {
  const job = jobs.get(jobId)

  if (!job) {
    return
  }

  job.status = 'failed'
  job.errorCode =
    typeof error?.code === 'string'
      ? error.code
      : 'DID_PROVIDER_ERROR'
  job.expiresAt =
    Date.now() + JOB_TTL_MS
}

export function getDIDAvatarJobStatus(
  access,
) {
  const job = requireOwnedJob(access)

  return {
    id: job.id,
    status: job.status,
    errorCode: job.errorCode,
    videoAvailable:
      job.status === 'ready' &&
      Buffer.isBuffer(job.videoBuffer),
    expiresAt: new Date(
      job.expiresAt,
    ).toISOString(),
  }
}

export function getDIDAvatarJobVideo(
  access,
) {
  const job = requireOwnedJob(access)

  if (
    job.status !== 'ready' ||
    !Buffer.isBuffer(job.videoBuffer)
  ) {
    throw new AppError(
      'The avatar video is not ready.',
      {
        statusCode: 409,
        code: 'DID_VIDEO_NOT_READY',
      },
    )
  }

  return {
    videoBuffer: job.videoBuffer,
    byteLength: job.byteLength,
    contentType: 'video/mp4',
    fileExtension: 'mp4',
  }
}

export function clearDIDAvatarJobsForMemory(
  memoryId,
) {
  for (const [jobId, job] of jobs) {
    if (job.memoryId === memoryId) {
      removeJob(jobId)
    }
  }
}

export function resetDIDAvatarJobsForTests() {
  for (const jobId of jobs.keys()) {
    removeJob(jobId)
  }
}
