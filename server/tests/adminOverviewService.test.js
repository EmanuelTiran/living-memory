import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => {
  const recentFailures = [
    {
      jobType: 'recording_transcription',
      resourceType: 'memory_recording',
      attemptCount: 3,
      maxAttempts: 3,
      lastErrorCode: 'TRANSCRIPTION_FAILED',
      createdAt:
        new Date('2026-08-24T10:00:00.000Z'),
      updatedAt:
        new Date('2026-08-24T10:05:00.000Z'),
      memoryId: 'private-memory-id',
      resourceId: 'private-resource-id',
      payload: {
        private: true,
      },
    },
  ]

  const lean = vi.fn()
    .mockResolvedValue(recentFailures)
  const select = vi.fn(() => ({ lean }))
  const limit = vi.fn(() => ({ select }))
  const sort = vi.fn(() => ({ limit }))

  return {
    userCount: vi.fn(),
    memoryCount: vi.fn(),
    storyCount: vi.fn(),
    biographyCount: vi.fn(),
    transcriptCount: vi.fn(),
    assetCount: vi.fn(),
    recordingCount: vi.fn(),
    jobCount: vi.fn(),
    jobFind: vi.fn(() => ({ sort })),
    sort,
    limit,
    select,
    lean,
  }
})

vi.mock('../src/modules/auth/User.js', () => ({
  default: {
    countDocuments: mocks.userCount,
  },
}))

vi.mock(
  '../src/modules/memories/MemoryProfile.js',
  () => ({
    default: {
      countDocuments: mocks.memoryCount,
    },
  }),
)

vi.mock(
  '../src/modules/memories/MemoryStory.js',
  () => ({
    default: {
      countDocuments: mocks.storyCount,
    },
  }),
)

vi.mock(
  '../src/modules/memories/MemoryBiographyAnswer.js',
  () => ({
    default: {
      countDocuments: mocks.biographyCount,
    },
  }),
)

vi.mock(
  '../src/modules/media/MemoryRecordingTranscript.js',
  () => ({
    default: {
      countDocuments: mocks.transcriptCount,
    },
  }),
)

vi.mock(
  '../src/modules/media/MemoryAsset.js',
  () => ({
    default: {
      countDocuments: mocks.assetCount,
    },
  }),
)

vi.mock(
  '../src/modules/media/MemoryRecording.js',
  () => ({
    default: {
      countDocuments: mocks.recordingCount,
    },
  }),
)

vi.mock(
  '../src/platform/jobs/ProcessingJob.js',
  () => ({
    PROCESSING_JOB_STATUSES: [
      'queued',
      'processing',
      'completed',
      'failed',
      'cancelled',
    ],
    default: {
      countDocuments: mocks.jobCount,
      find: mocks.jobFind,
    },
  }),
)

import { getAdminOverview } from '../src/modules/admin/adminOverviewService.js'

function statusCount(query, values) {
  return values[query.status] ?? 0
}

describe('Admin overview service', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.userCount.mockImplementation(
      (query) =>
        query.createdAt
          ? 2
          : statusCount(query, {
              active: 8,
              suspended: 1,
            }),
    )

    mocks.memoryCount.mockImplementation(
      (query) =>
        query.createdAt
          ? 3
          : statusCount(query, {
              active: 5,
              archived: 2,
            }),
    )

    mocks.storyCount.mockImplementation(
      (query) => statusCount(query, {
        draft: 4,
        approved: 6,
        archived: 1,
      }),
    )

    mocks.biographyCount.mockImplementation(
      (query) => statusCount(query, {
        draft: 3,
        approved: 7,
        archived: 2,
      }),
    )

    mocks.transcriptCount.mockImplementation(
      (query) => {
        if (
          query.lifecycleStatus ===
          'archived'
        ) {
          return 1
        }

        return {
          draft: 2,
          approved: 5,
        }[query.reviewStatus] ?? 0
      },
    )

    mocks.assetCount.mockImplementation(
      (query) => ({
        active: 9,
        archived: 3,
      })[query.lifecycleStatus] ?? 0,
    )

    mocks.recordingCount.mockImplementation(
      (query) => ({
        active: 4,
        archived: 1,
      })[query.lifecycleStatus] ?? 0,
    )

    mocks.jobCount.mockImplementation(
      (query) => {
        if (query.leaseExpiresAt) {
          return 1
        }

        if (query.completedAt) {
          return 12
        }

        if (query.updatedAt) {
          return 1
        }

        return statusCount(query, {
          queued: 2,
          processing: 1,
          completed: 20,
          failed: 3,
          cancelled: 1,
        })
      },
    )
  })

  it('returns aggregate operational data without private source content', async () => {
    const overview = await getAdminOverview(
      new Date('2026-08-25T10:00:00.000Z'),
    )

    expect(overview.accounts).toEqual({
      total: 9,
      active: 8,
      suspended: 1,
    })
    expect(overview.memories).toEqual({
      total: 7,
      active: 5,
      archived: 2,
    })
    expect(overview.sources).toMatchObject({
      total: 31,
      draft: 9,
      approved: 18,
      archived: 4,
    })
    expect(overview.processing).toMatchObject({
      total: 27,
      backlog: 3,
      stalled: 1,
      needsAttention: 4,
    })
    expect(overview.activityLast24Hours)
      .toEqual({
        newUsers: 2,
        newMemories: 3,
        completedJobs: 12,
        failedJobs: 1,
      })
    expect(overview.privacy).toEqual({
      containsPrivateContent: false,
      scope: 'operational_metadata_only',
    })

    expect(
      overview.processing.recentFailures[0],
    ).not.toHaveProperty('memoryId')
    expect(
      overview.processing.recentFailures[0],
    ).not.toHaveProperty('resourceId')
    expect(
      overview.processing.recentFailures[0],
    ).not.toHaveProperty('payload')
  })

  it('rejects an invalid reporting timestamp', async () => {
    await expect(
      getAdminOverview(new Date('invalid')),
    ).rejects.toThrow(
      'Admin overview timestamp must be valid.',
    )
  })
})
