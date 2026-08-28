import {
  describe,
  expect,
  it,
} from 'vitest'
import ProcessingJob from '../src/platform/jobs/ProcessingJob.js'

describe('Processing job model', () => {
  it('validates a queued persistent job and hides private execution data', async () => {
    const job = new ProcessingJob({
      memoryId:
        '507f1f77bcf86cd799439010',
      jobType:
        'memory_asset_parse',
      idempotencyKey:
        'memory-asset:507f1f77bcf86cd799439011:version-1',
      resourceType:
        'memory_asset',
      resourceId:
        '507f1f77bcf86cd799439011',
      payload: {
        assetId:
          '507f1f77bcf86cd799439011',
      },
      workerId:
        'private-worker-id',
      leaseExpiresAt:
        new Date(
          '2026-08-24T10:05:00.000Z',
        ),
    })

    await expect(
      job.validate(),
    ).resolves.toBeUndefined()

    expect(job.toJSON()).toMatchObject({
      jobType:
        'memory_asset_parse',
      status: 'queued',
      progress: 0,
      attemptCount: 0,
      maxAttempts: 3,
    })
    expect(job.toJSON())
      .not.toHaveProperty('payload')
    expect(job.toJSON())
      .not.toHaveProperty('workerId')
    expect(job.toJSON())
      .not.toHaveProperty(
        'leaseExpiresAt',
      )
  })
})
