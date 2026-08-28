import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { createProcessingWorker } from '../src/platform/jobs/processingWorker.js'

const workerId =
  'worker-test-identifier'
const jobId =
  '507f1f77bcf86cd799439010'

function createService(job) {
  return {
    recoverStaleProcessingJobs:
      vi.fn().mockResolvedValue(0),
    claimNextProcessingJob:
      vi.fn()
        .mockResolvedValueOnce(job)
        .mockResolvedValueOnce(null),
    updateProcessingJobProgress:
      vi.fn().mockResolvedValue({}),
    completeProcessingJob:
      vi.fn().mockResolvedValue({
        status: 'completed',
      }),
    failProcessingJob:
      vi.fn().mockResolvedValue({
        status: 'queued',
        lastErrorCode:
          'TEMPORARY_FAILURE',
      }),
  }
}

function createJob() {
  return {
    id: jobId,
    jobType:
      'memory_asset_parse',
    payload: {
      assetId:
        '507f1f77bcf86cd799439011',
    },
  }
}

describe('Processing worker', () => {
  it('claims, reports progress, and completes a job', async () => {
    const job = createJob()
    const service = createService(job)
    const run = vi.fn(
      async ({ updateProgress }) => {
        await updateProgress(60)

        return {
          parsed: true,
        }
      },
    )
    const worker =
      createProcessingWorker({
        handlers: {
          memory_asset_parse: {
            run,
          },
        },
        workerId,
        leaseMs: 5_000,
        service,
      })

    await expect(
      worker.runOnce(),
    ).resolves.toBe(1)

    expect(
      service.recoverStaleProcessingJobs,
    ).toHaveBeenCalledOnce()
    expect(
      service.updateProcessingJobProgress,
    ).toHaveBeenCalledWith({
      jobId,
      workerId,
      progress: 60,
    })
    expect(
      service.completeProcessingJob,
    ).toHaveBeenCalledWith({
      jobId,
      workerId,
      resultSummary: {
        parsed: true,
      },
    })
    expect(
      service.failProcessingJob,
    ).not.toHaveBeenCalled()
  })

  it('schedules retries and invokes the failure hook', async () => {
    const job = createJob()
    const service = createService(job)
    const error = Object.assign(
      new Error('temporary'),
      {
        code: 'TEMPORARY_FAILURE',
      },
    )
    const onFailure = vi.fn()
    const worker =
      createProcessingWorker({
        handlers: {
          memory_asset_parse: {
            run: vi.fn()
              .mockRejectedValue(error),
            onFailure,
          },
        },
        workerId,
        leaseMs: 5_000,
        service,
      })

    await expect(
      worker.runOnce(),
    ).resolves.toBe(1)

    expect(
      service.failProcessingJob,
    ).toHaveBeenCalledWith({
      jobId,
      workerId,
      error,
    })
    expect(onFailure)
      .toHaveBeenCalledWith({
        job,
        settledJob: {
          status: 'queued',
          lastErrorCode:
            'TEMPORARY_FAILURE',
        },
        error,
      })
  })
})
