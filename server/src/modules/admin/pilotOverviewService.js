import InterviewSession from '../memories/InterviewSession.js'
import FamilyQuestion from '../memories/FamilyQuestion.js'
import MemoryInvitation from '../memories/MemoryInvitation.js'
import MemoryParticipationConsent from '../memories/MemoryParticipationConsent.js'
import { getBehavioralPilotOverview } from './behavioralPilotOverviewService.js'

const STORYTELLER_ROLES = Object.freeze([
  'contributor',
  'editor',
  'steward',
])

function calculateRate(numerator, denominator) {
  if (denominator === 0) {
    return null
  }

  return Number(
    ((numerator / denominator) * 100)
      .toFixed(1),
  )
}

function countSessionThreshold(
  sessions,
  threshold,
) {
  return sessions.filter(
    (session) =>
      session.sessionCount >= threshold,
  ).length
}

export async function getPilotOverview(
  now = new Date(),
) {
  if (
    !(now instanceof Date) ||
    Number.isNaN(now.getTime())
  ) {
    throw new TypeError(
      'Pilot overview timestamp must be valid.',
    )
  }

  const [
    sent,
    pending,
    accepted,
    revoked,
    storedExpired,
    pendingExpired,
    consentsCompleted,
    acceptedMemoryIds,
    storytellerMemoryIds,
  ] = await Promise.all([
    MemoryInvitation.countDocuments({}),
    MemoryInvitation.countDocuments({
      status: 'pending',
      expiresAt: {
        $gt: now,
      },
    }),
    MemoryInvitation.countDocuments({
      status: 'accepted',
    }),
    MemoryInvitation.countDocuments({
      status: 'revoked',
    }),
    MemoryInvitation.countDocuments({
      status: 'expired',
    }),
    MemoryInvitation.countDocuments({
      status: 'pending',
      expiresAt: {
        $lte: now,
      },
    }),
    MemoryParticipationConsent.countDocuments(
      {},
    ),
    MemoryInvitation.distinct('memoryId', {
      status: 'accepted',
    }),
    MemoryInvitation.distinct('memoryId', {
      status: 'accepted',
      role: {
        $in: STORYTELLER_ROLES,
      },
    }),
  ])

  const completedSessions =
    storytellerMemoryIds.length === 0
      ? []
      : await InterviewSession.aggregate([
          {
            $match: {
              memoryId: {
                $in: storytellerMemoryIds,
              },
              status: 'completed',
            },
          },
          {
            $group: {
              _id: '$memoryId',
              sessionCount: {
                $sum: 1,
              },
            },
          },
        ])

  const familyQuestionMemoryIds =
    acceptedMemoryIds.length === 0
      ? []
      : await FamilyQuestion.distinct(
          'memoryId',
          {
            memoryId: {
              $in: acceptedMemoryIds,
            },
            status: 'active',
          },
        )

  const behavioral =
    await getBehavioralPilotOverview(now)

  const expired =
    storedExpired + pendingExpired
  const firstStoryMemories =
    countSessionThreshold(
      completedSessions,
      1,
    )
  const threeSessionMemories =
    countSessionThreshold(
      completedSessions,
      3,
    )

  return {
    generatedAt: now.toISOString(),
    privacy: {
      containsPrivateContent: false,
      scope: 'aggregate_pilot_metadata_only',
    },
    invitations: {
      sent,
      pending,
      accepted,
      revoked,
      expired,
      acceptanceRatePercent:
        calculateRate(accepted, sent),
    },
    consent: {
      completed: consentsCompleted,
      completionRatePercent:
        calculateRate(
          consentsCompleted,
          accepted,
        ),
    },
    capture: {
      acceptedStorytellerMemories:
        storytellerMemoryIds.length,
      firstStoryMemories,
      threeSessionMemories,
      firstStoryCompletionRatePercent:
        calculateRate(
          firstStoryMemories,
          storytellerMemoryIds.length,
        ),
      threeSessionRatePercent:
        calculateRate(
          threeSessionMemories,
          storytellerMemoryIds.length,
        ),
    },
    familyLoop: {
      acceptedMemories:
        acceptedMemoryIds.length,
      memoriesWithFamilyQuestions:
        familyQuestionMemoryIds.length,
      returnRatePercent:
        calculateRate(
          familyQuestionMemoryIds.length,
          acceptedMemoryIds.length,
        ),
    },
    behavioral,
  }
}
