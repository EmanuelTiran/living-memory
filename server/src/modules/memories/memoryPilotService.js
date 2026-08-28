import { AppError } from '../../errors/AppError.js'
import FamilyQuestion from './FamilyQuestion.js'
import InterviewSession from './InterviewSession.js'
import MemoryMembership from './MemoryMembership.js'
import MemoryPilotEnrollment, {
  MEMORY_PILOT_VERSION,
} from './MemoryPilotEnrollment.js'
import MemoryStory from './MemoryStory.js'
import {
  MEMORY_PERMISSIONS,
  requireMemoryPermission,
} from './memoryAccessService.js'

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
const PILOT_DURATION_MS = 28 * DAY_MS
const D30_MEASUREMENT_MS = 30 * DAY_MS

const STORYTELLER_ROLES = new Set([
  'contributor',
  'editor',
  'steward',
])

export const MEMORY_PILOT_TARGETS =
  Object.freeze({
    contributionWeeks: 3,
    familyQuestionWeeks: 2,
    familyReturnByDay: 14,
    durationDays: 28,
  })

export const MEMORY_PILOT_WEEKLY_PROMPTS =
  Object.freeze([
    Object.freeze({
      week: 1,
      title: 'מתחילים מהבית',
      prompt:
        'ספרו בקול על מקום מהילדות שאתם עדיין יכולים לראות בדמיון.',
    }),
    Object.freeze({
      week: 2,
      title: 'רגע ששינה כיוון',
      prompt:
        'ספרו על החלטה, מפגש או מעבר ששינו את המשך הדרך.',
    }),
    Object.freeze({
      week: 3,
      title: 'מה שעובר במשפחה',
      prompt:
        'תעדו מנהג, ביטוי, מתכון או ערך שהייתם רוצים להעביר הלאה.',
    }),
    Object.freeze({
      week: 4,
      title: 'שאלה לדור הבא',
      prompt:
        'ספרו מה הייתם רוצים שבני המשפחה יזכרו וישאלו עליו בעתיד.',
    }),
  ])

function assertValidNow(now) {
  if (
    !(now instanceof Date) ||
    Number.isNaN(now.getTime())
  ) {
    throw new TypeError(
      'Pilot timestamp must be valid.',
    )
  }
}

function asDate(value) {
  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? null
    : date
}

function asIdentifier(value) {
  return value?.toString?.() ?? String(value)
}

function getWeekNumber(
  timestamp,
  startedAt,
) {
  const date = asDate(timestamp)

  if (!date) {
    return null
  }

  const elapsed =
    date.getTime() - startedAt.getTime()

  if (
    elapsed < 0 ||
    elapsed >= PILOT_DURATION_MS
  ) {
    return null
  }

  return Math.floor(elapsed / WEEK_MS) + 1
}

function uniqueSorted(values) {
  return [
    ...new Set(
      values.filter(
        (value) => value !== null,
      ),
    ),
  ].sort((first, second) => first - second)
}

function serializeDate(value) {
  return asDate(value)?.toISOString() ?? null
}

function createProgramSummary() {
  return {
    version: MEMORY_PILOT_VERSION,
    durationDays:
      MEMORY_PILOT_TARGETS.durationDays,
    targets: MEMORY_PILOT_TARGETS,
    weeklyPrompts:
      MEMORY_PILOT_WEEKLY_PROMPTS,
    measurementRule:
      'meaningful_family_interactions_only',
  }
}

function createWeekSummaries({
  startedAt,
  now,
  contributionEvents,
  familyQuestions,
}) {
  const elapsed = now.getTime() -
    startedAt.getTime()
  const currentWeek = Math.min(
    4,
    Math.max(
      1,
      Math.floor(
        Math.max(0, elapsed) / WEEK_MS,
      ) + 1,
    ),
  )

  return MEMORY_PILOT_WEEKLY_PROMPTS.map(
    (prompt) => {
      const start = new Date(
        startedAt.getTime() +
          (prompt.week - 1) * WEEK_MS,
      )
      const end = new Date(
        start.getTime() + WEEK_MS,
      )

      return {
        ...prompt,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        contributionCount:
          contributionEvents.filter(
            (event) =>
              getWeekNumber(
                event.occurredAt,
                startedAt,
              ) === prompt.week,
          ).length,
        familyQuestionCount:
          familyQuestions.filter(
            (question) =>
              getWeekNumber(
                question.createdAt,
                startedAt,
              ) === prompt.week,
          ).length,
        isCurrent:
          elapsed < PILOT_DURATION_MS &&
          prompt.week === currentWeek,
        isPast: now >= end,
      }
    },
  )
}

export function buildMemoryPilotProgress({
  enrollment,
  sessions = [],
  stories = [],
  questions = [],
  memberships = [],
  now = new Date(),
}) {
  assertValidNow(now)

  if (!enrollment) {
    return null
  }

  const startedAt = asDate(
    enrollment.startedAt,
  )
  const endsAt = asDate(enrollment.endsAt)

  if (!startedAt || !endsAt) {
    throw new TypeError(
      'Pilot enrollment dates must be valid.',
    )
  }

  const storytellerUserIds = new Set(
    memberships
      .filter(
        (membership) =>
          membership.status === 'active' &&
          STORYTELLER_ROLES.has(
            membership.role,
          ),
      )
      .map((membership) =>
        asIdentifier(membership.userId),
      ),
  )

  if (storytellerUserIds.size === 0) {
    storytellerUserIds.add(
      asIdentifier(enrollment.ownerUserId),
    )
  }

  const sessionEvents = sessions
    .filter((session) =>
      storytellerUserIds.has(
        asIdentifier(
          session.startedByUserId,
        ),
      ),
    )
    .map((session) => ({
      type: 'completed_interview',
      occurredAt: session.completedAt,
    }))

  const storyEvents = stories
    .filter((story) =>
      storytellerUserIds.has(
        asIdentifier(story.authorId),
      ),
    )
    .map((story) => ({
      type: 'approved_story',
      occurredAt: story.updatedAt,
    }))

  const allContributionEvents = [
    ...sessionEvents,
    ...storyEvents,
  ]
  const contributionEvents =
    allContributionEvents.filter(
    (event) =>
      getWeekNumber(
        event.occurredAt,
        startedAt,
      ) !== null,
  )

  const allFamilyQuestions = questions.filter(
    (question) =>
      !storytellerUserIds.has(
        asIdentifier(
          question.askedByUserId,
        ),
      ),
  )
  const familyQuestions =
    allFamilyQuestions.filter(
      (question) =>
      getWeekNumber(
        question.createdAt,
        startedAt,
      ) !== null,
  )

  const contributionWeeks = uniqueSorted(
    contributionEvents.map((event) =>
      getWeekNumber(
        event.occurredAt,
        startedAt,
      ),
    ),
  )
  const familyQuestionWeeks = uniqueSorted(
    familyQuestions.map((question) =>
      getWeekNumber(
        question.createdAt,
        startedAt,
      ),
    ),
  )

  const weekTwoEndsAt = new Date(
    startedAt.getTime() + 2 * WEEK_MS,
  )
  const d30At = new Date(
    startedAt.getTime() +
      D30_MEASUREMENT_MS,
  )
  const d30ActivityWindowStartsAt =
    new Date(
      d30At.getTime() - WEEK_MS,
    )
  const meaningfulDates = [
    ...allContributionEvents.map(
      (event) => asDate(event.occurredAt),
    ),
    ...allFamilyQuestions.map(
      (question) =>
        asDate(question.createdAt),
    ),
  ].filter(Boolean)

  const familyReturnedByWeekTwo =
    familyQuestions.some(
      (question) =>
        asDate(question.createdAt) <
        weekTwoEndsAt,
    )
  const d30Active = meaningfulDates.some(
    (date) =>
      date >= d30ActivityWindowStartsAt &&
      date < d30At,
  )
  const phase =
    enrollment.status === 'withdrawn'
      ? 'withdrawn'
      : now >= endsAt
        ? 'completed'
        : 'active'
  const daysRemaining = Math.max(
    0,
    Math.ceil(
      (endsAt.getTime() - now.getTime()) /
        DAY_MS,
    ),
  )

  const gates = {
    threeContributionWeeks: {
      count: contributionWeeks.length,
      target:
        MEMORY_PILOT_TARGETS.contributionWeeks,
      met:
        contributionWeeks.length >=
        MEMORY_PILOT_TARGETS.contributionWeeks,
      eligible: now >= endsAt,
    },
    familyReturnByWeekTwo: {
      met: familyReturnedByWeekTwo,
      eligible: now >= weekTwoEndsAt,
      deadlineAt:
        weekTwoEndsAt.toISOString(),
    },
    twoFamilyQuestionWeeks: {
      count: familyQuestionWeeks.length,
      target:
        MEMORY_PILOT_TARGETS.familyQuestionWeeks,
      met:
        familyQuestionWeeks.length >=
        MEMORY_PILOT_TARGETS.familyQuestionWeeks,
      eligible: now >= endsAt,
    },
    d30HouseholdActive: {
      met: d30Active,
      eligible: now >= d30At,
      measuredAt: d30At.toISOString(),
    },
  }

  return {
    enrollment: {
      id: asIdentifier(
        enrollment._id ?? enrollment.id,
      ),
      version: enrollment.version,
      phase,
      startedAt: startedAt.toISOString(),
      endsAt: endsAt.toISOString(),
      withdrawnAt: serializeDate(
        enrollment.withdrawnAt,
      ),
      daysRemaining,
    },
    gates,
    progress: {
      meaningfulInteractionCount:
        allContributionEvents.length +
        allFamilyQuestions.length,
      contributionWeeks,
      familyQuestionWeeks,
      coreLoopCompleted:
        gates.threeContributionWeeks.met &&
        gates.familyReturnByWeekTwo.met &&
        gates.twoFamilyQuestionWeeks.met,
    },
    weeks: createWeekSummaries({
      startedAt,
      now,
      contributionEvents,
      familyQuestions,
    }),
  }
}

async function loadPilotBehavior(
  memoryId,
  enrollment,
) {
  const timeWindow = {
    $gte: enrollment.startedAt,
    $lt: new Date(
      new Date(
        enrollment.startedAt,
      ).getTime() + D30_MEASUREMENT_MS,
    ),
  }

  return Promise.all([
    InterviewSession.find({
      memoryId,
      status: 'completed',
      completedAt: timeWindow,
    })
      .select('startedByUserId completedAt')
      .lean(),
    MemoryStory.find({
      memoryId,
      status: 'approved',
      updatedAt: timeWindow,
    })
      .select('authorId updatedAt')
      .lean(),
    FamilyQuestion.find({
      memoryId,
      status: 'active',
      createdAt: timeWindow,
    })
      .select('askedByUserId createdAt')
      .lean(),
    MemoryMembership.find({
      memoryId,
      status: 'active',
    })
      .select('userId role status')
      .lean(),
  ])
}

async function createPilotResponse({
  enrollment,
  authorizationRole,
  now,
}) {
  const canManage = [
    'owner',
    'steward',
  ].includes(authorizationRole)

  if (!enrollment) {
    return {
      canManage,
      program: createProgramSummary(),
      pilot: null,
    }
  }

  const [
    sessions,
    stories,
    questions,
    memberships,
  ] = await loadPilotBehavior(
    enrollment.memoryId,
    enrollment,
  )

  return {
    canManage,
    program: createProgramSummary(),
    pilot: buildMemoryPilotProgress({
      enrollment,
      sessions,
      stories,
      questions,
      memberships,
      now,
    }),
  }
}

export async function getMemoryPilot(
  userId,
  memoryId,
  now = new Date(),
) {
  assertValidNow(now)

  const { authorization } =
    await requireMemoryPermission(
      userId,
      memoryId,
      MEMORY_PERMISSIONS.VIEW,
    )

  const enrollment =
    await MemoryPilotEnrollment.findOne({
      memoryId,
    }).lean()

  return createPilotResponse({
    enrollment,
    authorizationRole: authorization.role,
    now,
  })
}

export async function startMemoryPilot(
  userId,
  memoryId,
  now = new Date(),
) {
  assertValidNow(now)

  const {
    memoryProfile,
    authorization,
  } = await requireMemoryPermission(
    userId,
    memoryId,
    MEMORY_PERMISSIONS.MANAGE,
  )

  let enrollment =
    await MemoryPilotEnrollment.findOne({
      memoryId,
    }).lean()
  let created = false

  if (!enrollment) {
    try {
      const document =
        await MemoryPilotEnrollment.create({
          memoryId,
          ownerUserId:
            memoryProfile.ownerId,
          startedByUserId: userId,
          version: MEMORY_PILOT_VERSION,
          status: 'active',
          startedAt: now,
          endsAt: new Date(
            now.getTime() +
              PILOT_DURATION_MS,
          ),
        })

      enrollment = document.toObject()
      created = true
    } catch (error) {
      if (error?.code !== 11000) {
        throw error
      }

      enrollment =
        await MemoryPilotEnrollment
          .findOne({ memoryId })
          .lean()
    }
  }

  const response = await createPilotResponse({
    enrollment,
    authorizationRole: authorization.role,
    now,
  })

  return {
    ...response,
    created,
  }
}

export async function withdrawMemoryPilot(
  userId,
  memoryId,
  now = new Date(),
) {
  assertValidNow(now)

  const { authorization } =
    await requireMemoryPermission(
      userId,
      memoryId,
      MEMORY_PERMISSIONS.MANAGE,
    )

  const enrollment =
    await MemoryPilotEnrollment
      .findOneAndUpdate(
        {
          memoryId,
          status: 'active',
        },
        {
          $set: {
            status: 'withdrawn',
            withdrawnAt: now,
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        },
      )
      .lean()

  if (!enrollment) {
    throw new AppError(
      'Active memory pilot was not found.',
      {
        statusCode: 404,
        code:
          'MEMORY_PILOT_NOT_ACTIVE',
      },
    )
  }

  return createPilotResponse({
    enrollment,
    authorizationRole: authorization.role,
    now,
  })
}
