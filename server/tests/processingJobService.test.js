import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  findOneAndUpdate: vi.fn(),
  findOne: vi.fn(),
  updateMany: vi.fn(),
}))

vi.mock(
  '../src/platform/jobs/ProcessingJob.js',
  () => ({
    PROCESSING_JOB_TYPES: [
      'memory_asset_parse',
    ],
    default: {
      findOneAndUpdate:
        mocks.findOneAndUpdate,
      findOne: mocks.findOne,
      updateMany: mocks.updateMany,
    },
  }),
)

import {
  enqueueProcessingJob,
  failProcessingJob,
  recoverStaleProcessingJobs,
} from '../src/platform/jobs/processingJobService.js'

const memoryId =
  '507f1f77bcf86cd799439010'
const resourceId =
  '507f1f77bcf86cd799439011'
const jobId =
  '507f1f77bcf86cd799439012'
const workerId =
  'worker-test-identifier'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('Processing job service', () => {
  it('enqueues idempotently with a unique logical key', async () => {
    const job = {
      id: jobId,
      status: 'queued',
    }

    mocks.findOneAndUpdate
      .mockResolvedValue(job)

    const result =
      await enqueueProcessingJob({
        memoryId,
        jobType:
          'memory_asset_parse',
        idempotencyKey:
          `asset:${resourceId}:version-1`,
        resourceType:
          'memory_asset',
        resourceId,
        payload: {
          assetId: resourceId,
        },
        maxAttempts: 3,
      })

    expect(result).toBe(job)
    expect(
      mocks.findOneAndUpdate,
    ).toHaveBeenCalledWith(
      {
        jobType:
          'memory_asset_parse',
        idempotencyKey:
          `asset:${resourceId}:version-1`,
      },
      expect.objectContaining({
        $setOnInsert:
          expect.objectContaining({
            memoryId,
            resourceId,
            status: 'queued',
            attemptCount: 0,
          }),
      }),
      expect.objectContaining({
        upsert: true,
        returnDocument: 'after',
        setDefaultsOnInsert: true,
      }),
    )
  })

  it('requeues a failed attempt with exponential backoff', async () => {
    const select = vi.fn()
      .mockResolvedValue({
        attemptCount: 2,
        maxAttempts: 3,
      })

    mocks.findOne.mockReturnValue({
      select,
    })
    mocks.findOneAndUpdate
      .mockResolvedValue({
        id: jobId,
        status: 'queued',
      })

    const now = new Date(
      '2026-08-24T10:00:00.000Z',
    )
    const error = Object.assign(
      new Error('temporary'),
      {
        code:
          'TEMPORARY_PROVIDER_FAILURE',
      },
    )

    const result =
      await failProcessingJob({
        jobId,
        workerId,
        error,
        now,
        retryDelayMs: 1_000,
      })

    expect(result.status).toBe('queued')
    expect(
      mocks.findOneAndUpdate,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: jobId,
        attemptCount: 2,
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'queued',
          nextRunAt: new Date(
            '2026-08-24T10:00:02.000Z',
          ),
          lastErrorCode:
            'TEMPORARY_PROVIDER_FAILURE',
        }),
      }),
      expect.any(Object),
    )
  })

  it('recovers expired leases and permanently fails exhausted jobs', async () => {
    mocks.updateMany
      .mockResolvedValueOnce({
        modifiedCount: 2,
      })
      .mockResolvedValueOnce({
        modifiedCount: 3,
      })

    const now = new Date(
      '2026-08-24T10:00:00.000Z',
    )

    await expect(
      recoverStaleProcessingJobs(now),
    ).resolves.toBe(5)

    expect(mocks.updateMany)
      .toHaveBeenCalledTimes(2)
    expect(
      mocks.updateMany.mock.calls[0][1],
    ).toMatchObject({
      $set: {
        status: 'failed',
        completedAt: now,
        lastErrorCode:
          'PROCESSING_JOB_LEASE_EXPIRED',
      },
    })
    expect(
      mocks.updateMany.mock.calls[1][1],
    ).toMatchObject({
      $set: {
        status: 'queued',
        nextRunAt: now,
        lastErrorCode:
          'PROCESSING_JOB_LEASE_EXPIRED',
      },
    })
  })
})
