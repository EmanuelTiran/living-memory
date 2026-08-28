import User from '../auth/User.js'
import MemoryAsset from '../media/MemoryAsset.js'
import MemoryRecording from '../media/MemoryRecording.js'
import MemoryRecordingTranscript from '../media/MemoryRecordingTranscript.js'
import MemoryBiographyAnswer from '../memories/MemoryBiographyAnswer.js'
import MemoryProfile from '../memories/MemoryProfile.js'
import MemoryStory from '../memories/MemoryStory.js'
import ProcessingJob, {
  PROCESSING_JOB_STATUSES,
} from '../../platform/jobs/ProcessingJob.js'

const RECENT_FAILURE_LIMIT = 8
const ONE_DAY_MS = 24 * 60 * 60 * 1000

function sumCounts(counts) {
  return Object.values(counts).reduce(
    (total, value) => total + value,
    0,
  )
}

async function countStatuses(
  Model,
  field,
  statuses,
  baseFilter = {},
) {
  const values = await Promise.all(
    statuses.map((status) =>
      Model.countDocuments({
        ...baseFilter,
        [field]: status,
      }),
    ),
  )

  return Object.fromEntries(
    statuses.map((status, index) => [
      status,
      values[index],
    ]),
  )
}

function createSourceSummary({
  draft,
  approved,
  archived,
}) {
  return {
    total: draft + approved + archived,
    draft,
    approved,
    archived,
  }
}

function sanitizeRecentFailure(job) {
  return {
    jobType: job.jobType,
    resourceType: job.resourceType,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    lastErrorCode:
      job.lastErrorCode ??
      'UNKNOWN_PROCESSING_ERROR',
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }
}

export async function getAdminOverview(
  now = new Date(),
) {
  if (
    !(now instanceof Date) ||
    Number.isNaN(now.getTime())
  ) {
    throw new TypeError(
      'Admin overview timestamp must be valid.',
    )
  }

  const since = new Date(
    now.getTime() - ONE_DAY_MS,
  )

  const [
    accounts,
    memories,
    stories,
    biographyAnswers,
    activeTranscriptReviews,
    archivedTranscripts,
    assets,
    recordings,
    jobs,
    stalledJobs,
    recentFailures,
    newUsers,
    newMemories,
    completedJobs,
    failedJobs,
  ] = await Promise.all([
    countStatuses(
      User,
      'status',
      ['active', 'suspended'],
    ),
    countStatuses(
      MemoryProfile,
      'status',
      ['active', 'archived'],
    ),
    countStatuses(
      MemoryStory,
      'status',
      ['draft', 'approved', 'archived'],
    ),
    countStatuses(
      MemoryBiographyAnswer,
      'status',
      ['draft', 'approved', 'archived'],
    ),
    countStatuses(
      MemoryRecordingTranscript,
      'reviewStatus',
      ['draft', 'approved'],
      {
        lifecycleStatus: 'active',
      },
    ),
    MemoryRecordingTranscript.countDocuments({
      lifecycleStatus: 'archived',
    }),
    countStatuses(
      MemoryAsset,
      'lifecycleStatus',
      ['active', 'archived'],
    ),
    countStatuses(
      MemoryRecording,
      'lifecycleStatus',
      ['active', 'archived'],
    ),
    countStatuses(
      ProcessingJob,
      'status',
      PROCESSING_JOB_STATUSES,
    ),
    ProcessingJob.countDocuments({
      status: 'processing',
      leaseExpiresAt: {
        $lt: now,
      },
    }),
    ProcessingJob.find({
      status: 'failed',
    })
      .sort({ updatedAt: -1 })
      .limit(RECENT_FAILURE_LIMIT)
      .select(
        'jobType resourceType attemptCount maxAttempts lastErrorCode createdAt updatedAt',
      )
      .lean(),
    User.countDocuments({
      createdAt: {
        $gte: since,
      },
    }),
    MemoryProfile.countDocuments({
      createdAt: {
        $gte: since,
      },
    }),
    ProcessingJob.countDocuments({
      status: 'completed',
      completedAt: {
        $gte: since,
      },
    }),
    ProcessingJob.countDocuments({
      status: 'failed',
      updatedAt: {
        $gte: since,
      },
    }),
  ])

  const transcriptSources =
    createSourceSummary({
      draft:
        activeTranscriptReviews.draft,
      approved:
        activeTranscriptReviews.approved,
      archived: archivedTranscripts,
    })

  const storySources =
    createSourceSummary(stories)

  const biographySources =
    createSourceSummary(
      biographyAnswers,
    )

  const sources = createSourceSummary({
    draft:
      storySources.draft +
      biographySources.draft +
      transcriptSources.draft,
    approved:
      storySources.approved +
      biographySources.approved +
      transcriptSources.approved,
    archived:
      storySources.archived +
      biographySources.archived +
      transcriptSources.archived,
  })

  return {
    generatedAt: now.toISOString(),
    privacy: {
      containsPrivateContent: false,
      scope: 'operational_metadata_only',
    },
    accounts: {
      total: sumCounts(accounts),
      ...accounts,
    },
    memories: {
      total: sumCounts(memories),
      ...memories,
    },
    sources: {
      ...sources,
      byType: {
        stories: storySources,
        biographyAnswers:
          biographySources,
        recordingTranscripts:
          transcriptSources,
      },
    },
    media: {
      assets: {
        total: sumCounts(assets),
        ...assets,
      },
      recordings: {
        total: sumCounts(recordings),
        ...recordings,
      },
    },
    processing: {
      total: sumCounts(jobs),
      ...jobs,
      backlog:
        jobs.queued + jobs.processing,
      stalled: stalledJobs,
      needsAttention:
        jobs.failed + stalledJobs,
      recentFailures:
        recentFailures.map(
          sanitizeRecentFailure,
        ),
    },
    activityLast24Hours: {
      newUsers,
      newMemories,
      completedJobs,
      failedJobs,
    },
  }
}
