import FamilyQuestion from '../memories/FamilyQuestion.js'
import InterviewSession from '../memories/InterviewSession.js'
import MemoryMembership from '../memories/MemoryMembership.js'
import MemoryPilotEnrollment from '../memories/MemoryPilotEnrollment.js'
import MemoryStory from '../memories/MemoryStory.js'
import {
  buildMemoryPilotProgress,
} from '../memories/memoryPilotService.js'

const PILOT_GATE_TARGETS =
  Object.freeze({
    threeContributionWeeks: 50,
    familyReturnByWeekTwo: 50,
    twoFamilyQuestionWeeks: 35,
    d30HouseholdActive: 40,
  })

function calculateRate(numerator, denominator) {
  if (denominator === 0) {
    return null
  }

  return Number(
    ((numerator / denominator) * 100)
      .toFixed(1),
  )
}

function getIdentifier(value) {
  return value?.toString?.() ?? String(value)
}

function groupByMemory(items) {
  const grouped = new Map()

  for (const item of items) {
    const memoryId = getIdentifier(
      item.memoryId,
    )
    const existing = grouped.get(memoryId) ?? []

    existing.push(item)
    grouped.set(memoryId, existing)
  }

  return grouped
}

function summarizeGate(
  progressItems,
  gateName,
) {
  const eligibleItems = progressItems.filter(
    (progress) =>
      progress.gates[gateName].eligible,
  )
  const met = eligibleItems.filter(
    (progress) =>
      progress.gates[gateName].met,
  ).length

  return {
    eligible: eligibleItems.length,
    met,
    ratePercent: calculateRate(
      met,
      eligibleItems.length,
    ),
    targetPercent:
      PILOT_GATE_TARGETS[gateName],
  }
}

function emptyOverview(now) {
  return {
    generatedAt: now.toISOString(),
    privacy: {
      containsPrivateContent: false,
      scope:
        'aggregate_behavioral_pilot_metadata_only',
    },
    cohort: {
      enrolled: 0,
      active: 0,
      completed: 0,
      withdrawn: 0,
    },
    northStar: {
      meaningfulFamilyInteractions: 0,
      averagePerParticipatingMemory: null,
    },
    gates: {
      threeContributionWeeks:
        summarizeGate(
          [],
          'threeContributionWeeks',
        ),
      familyReturnByWeekTwo:
        summarizeGate(
          [],
          'familyReturnByWeekTwo',
        ),
      twoFamilyQuestionWeeks:
        summarizeGate(
          [],
          'twoFamilyQuestionWeeks',
        ),
      d30HouseholdActive:
        summarizeGate(
          [],
          'd30HouseholdActive',
        ),
    },
    coreLoop: {
      eligible: 0,
      completed: 0,
      completionRatePercent: null,
    },
  }
}

export async function getBehavioralPilotOverview(
  now = new Date(),
) {
  if (
    !(now instanceof Date) ||
    Number.isNaN(now.getTime())
  ) {
    throw new TypeError(
      'Behavioral pilot overview timestamp must be valid.',
    )
  }

  const enrollments =
    await MemoryPilotEnrollment.find({}).lean()

  if (enrollments.length === 0) {
    return emptyOverview(now)
  }

  const memoryIds = enrollments.map(
    (enrollment) => enrollment.memoryId,
  )
  const earliestStart = new Date(
    Math.min(
      ...enrollments.map((enrollment) =>
        new Date(
          enrollment.startedAt,
        ).getTime(),
      ),
    ),
  )
  const latestEnd = new Date(
    Math.max(
      ...enrollments.map((enrollment) =>
        new Date(
          enrollment.endsAt,
        ).getTime() +
        2 * 24 * 60 * 60 * 1000,
      ),
    ),
  )
  const timeWindow = {
    $gte: earliestStart,
    $lt: latestEnd,
  }

  const [
    sessions,
    stories,
    questions,
    memberships,
  ] = await Promise.all([
    InterviewSession.find({
      memoryId: {
        $in: memoryIds,
      },
      status: 'completed',
      completedAt: timeWindow,
    })
      .select(
        'memoryId startedByUserId completedAt',
      )
      .lean(),
    MemoryStory.find({
      memoryId: {
        $in: memoryIds,
      },
      status: 'approved',
      updatedAt: timeWindow,
    })
      .select('memoryId authorId updatedAt')
      .lean(),
    FamilyQuestion.find({
      memoryId: {
        $in: memoryIds,
      },
      status: 'active',
      createdAt: timeWindow,
    })
      .select(
        'memoryId askedByUserId createdAt',
      )
      .lean(),
    MemoryMembership.find({
      memoryId: {
        $in: memoryIds,
      },
      status: 'active',
    })
      .select(
        'memoryId userId role status',
      )
      .lean(),
  ])

  const sessionsByMemory =
    groupByMemory(sessions)
  const storiesByMemory =
    groupByMemory(stories)
  const questionsByMemory =
    groupByMemory(questions)
  const membershipsByMemory =
    groupByMemory(memberships)

  const progressItems = enrollments
    .filter(
      (enrollment) =>
        enrollment.status !== 'withdrawn',
    )
    .map((enrollment) => {
      const memoryId = getIdentifier(
        enrollment.memoryId,
      )

      return buildMemoryPilotProgress({
        enrollment,
        sessions:
          sessionsByMemory.get(memoryId) ?? [],
        stories:
          storiesByMemory.get(memoryId) ?? [],
        questions:
          questionsByMemory.get(memoryId) ?? [],
        memberships:
          membershipsByMemory.get(memoryId) ?? [],
        now,
      })
    })

  const completed = progressItems.filter(
    (progress) =>
      progress.enrollment.phase ===
      'completed',
  )
  const coreLoopCompleted = completed.filter(
    (progress) =>
      progress.progress.coreLoopCompleted,
  ).length
  const meaningfulFamilyInteractions =
    progressItems.reduce(
      (total, progress) =>
        total +
        progress.progress
          .meaningfulInteractionCount,
      0,
    )

  return {
    generatedAt: now.toISOString(),
    privacy: {
      containsPrivateContent: false,
      scope:
        'aggregate_behavioral_pilot_metadata_only',
    },
    cohort: {
      enrolled: enrollments.length,
      active: progressItems.filter(
        (progress) =>
          progress.enrollment.phase ===
          'active',
      ).length,
      completed: completed.length,
      withdrawn:
        enrollments.length -
        progressItems.length,
    },
    northStar: {
      meaningfulFamilyInteractions,
      averagePerParticipatingMemory:
        progressItems.length === 0
          ? null
          : Number(
              (
                meaningfulFamilyInteractions /
                progressItems.length
              ).toFixed(1),
            ),
    },
    gates: {
      threeContributionWeeks:
        summarizeGate(
          progressItems,
          'threeContributionWeeks',
        ),
      familyReturnByWeekTwo:
        summarizeGate(
          progressItems,
          'familyReturnByWeekTwo',
        ),
      twoFamilyQuestionWeeks:
        summarizeGate(
          progressItems,
          'twoFamilyQuestionWeeks',
        ),
      d30HouseholdActive:
        summarizeGate(
          progressItems,
          'd30HouseholdActive',
        ),
    },
    coreLoop: {
      eligible: completed.length,
      completed: coreLoopCompleted,
      completionRatePercent:
        calculateRate(
          coreLoopCompleted,
          completed.length,
        ),
    },
  }
}
