import {
  expect,
  test,
} from '@playwright/test'

const MEMORY_ID =
  '507f1f77bcf86cd799439010'
const PILOT_PATH =
  `/api/family-access/memories/${MEMORY_ID}/pilot`
const STARTED_AT =
  '2026-08-26T08:00:00.000Z'
const ENDS_AT =
  '2026-09-23T08:00:00.000Z'

const weeklyPrompts = [
  {
    week: 1,
    title: 'מתחילים מהבית',
    prompt:
      'ספרו בקול על מקום מהילדות שאתם עדיין יכולים לראות בדמיון.',
  },
  {
    week: 2,
    title: 'רגע ששינה כיוון',
    prompt:
      'ספרו על החלטה, מפגש או מעבר ששינו את המשך הדרך.',
  },
  {
    week: 3,
    title: 'מה שעובר במשפחה',
    prompt:
      'תעדו מנהג, ביטוי, מתכון או ערך שהייתם רוצים להעביר הלאה.',
  },
  {
    week: 4,
    title: 'שאלה לדור הבא',
    prompt:
      'ספרו מה הייתם רוצים שבני המשפחה יזכרו וישאלו עליו בעתיד.',
  },
]

const program = {
  version: 'family-behavioral-pilot-v1',
  durationDays: 28,
  targets: {
    contributionWeeks: 3,
    familyQuestionWeeks: 2,
    familyReturnByDay: 14,
    durationDays: 28,
  },
  weeklyPrompts,
  measurementRule:
    'meaningful_family_interactions_only',
}

function addDays(value, days) {
  const date = new Date(value)

  date.setUTCDate(
    date.getUTCDate() + days,
  )

  return date.toISOString()
}

function createPilotSnapshot({
  phase = 'active',
  contributionCount = 0,
  familyQuestionCount = 0,
  familyReturned = false,
} = {}) {
  const contributionWeeks =
    contributionCount > 0 ? [1] : []
  const familyQuestionWeeks =
    familyQuestionCount > 0 ? [1] : []

  return {
    enrollment: {
      id:
        '507f1f77bcf86cd799439011',
      version:
        'family-behavioral-pilot-v1',
      phase,
      startedAt: STARTED_AT,
      endsAt: ENDS_AT,
      withdrawnAt:
        phase === 'withdrawn'
          ? '2026-08-26T10:00:00.000Z'
          : null,
      daysRemaining:
        phase === 'active' ? 28 : 0,
    },
    gates: {
      threeContributionWeeks: {
        count: contributionWeeks.length,
        target: 3,
        met: false,
        eligible: false,
      },
      familyReturnByWeekTwo: {
        met: familyReturned,
        eligible: false,
        deadlineAt:
          '2026-09-09T08:00:00.000Z',
      },
      twoFamilyQuestionWeeks: {
        count: familyQuestionWeeks.length,
        target: 2,
        met: false,
        eligible: false,
      },
      d30HouseholdActive: {
        met: false,
        eligible: false,
        measuredAt:
          '2026-09-25T08:00:00.000Z',
      },
    },
    progress: {
      meaningfulInteractionCount:
        contributionCount +
        familyQuestionCount,
      contributionWeeks,
      familyQuestionWeeks,
      coreLoopCompleted: false,
    },
    weeks: weeklyPrompts.map(
      (prompt) => ({
        ...prompt,
        startsAt: addDays(
          STARTED_AT,
          (prompt.week - 1) * 7,
        ),
        endsAt: addDays(
          STARTED_AT,
          prompt.week * 7,
        ),
        contributionCount:
          prompt.week === 1
            ? contributionCount
            : 0,
        familyQuestionCount:
          prompt.week === 1
            ? familyQuestionCount
            : 0,
        isCurrent:
          phase === 'active' &&
          prompt.week === 1,
        isPast: false,
      }),
    ),
  }
}

async function fulfillJson(
  route,
  payload,
  status = 200,
) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  })
}

async function installPilotApiMock(
  page,
  {
    canManage = true,
  } = {},
) {
  let pilot = null
  let startRequestCount = 0

  await page.route(
    '**/api/**',
    async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const method = request.method()

      if (!url.pathname.startsWith('/api/')) {
        await route.continue()
        return
      }

      if (
        url.pathname ===
          '/api/auth/refresh' &&
        method === 'POST'
      ) {
        await fulfillJson(route, {
          success: true,
          data: {
            accessToken:
              'e2e-access-token',
            user: {
              id:
                '507f1f77bcf86cd799439012',
              displayName: 'בדיקת פיילוט',
              email:
                'pilot-e2e@example.test',
              systemRole: 'user',
            },
          },
        })
        return
      }

      if (
        url.pathname === PILOT_PATH &&
        method === 'GET'
      ) {
        await fulfillJson(route, {
          success: true,
          data: {
            canManage,
            program,
            pilot,
          },
        })
        return
      }

      if (
        url.pathname === PILOT_PATH &&
        method === 'POST'
      ) {
        startRequestCount += 1
        pilot = createPilotSnapshot()

        await fulfillJson(
          route,
          {
            success: true,
            data: {
              canManage,
              program,
              pilot,
              created: true,
            },
          },
          201,
        )
        return
      }

      if (
        url.pathname ===
          `${PILOT_PATH}/withdraw` &&
        method === 'PATCH'
      ) {
        pilot = createPilotSnapshot({
          phase: 'withdrawn',
          contributionCount:
            pilot?.weeks?.[0]
              ?.contributionCount ?? 0,
          familyQuestionCount:
            pilot?.weeks?.[0]
              ?.familyQuestionCount ?? 0,
          familyReturned:
            pilot?.gates
              ?.familyReturnByWeekTwo
              ?.met ?? false,
        })

        await fulfillJson(route, {
          success: true,
          data: {
            canManage,
            program,
            pilot,
          },
        })
        return
      }

      await fulfillJson(
        route,
        {
          error: {
            code: 'E2E_UNMOCKED_REQUEST',
            message:
              `${method} ${url.pathname} was not mocked.`,
          },
        },
        501,
      )
    },
  )

  return {
    getStartRequestCount() {
      return startRequestCount
    },
    recordWeekOneActivity({
      contributionCount,
      familyQuestionCount,
    }) {
      pilot = createPilotSnapshot({
        contributionCount,
        familyQuestionCount,
        familyReturned:
          familyQuestionCount > 0,
      })
    },
  }
}

test.describe(
  'Four-week behavioral pilot',
  () => {
    test('starts, measures distinct behavior, persists after refresh, and withdraws safely', async ({
      page,
    }) => {
      const api =
        await installPilotApiMock(page)

      await page.goto(
        `/app/memories/${MEMORY_ID}/pilot`,
      )

      await expect(
        page.getByRole('heading', {
          name:
            'ארבעה שבועות של זיכרון חי',
        }),
      ).toBeVisible()
      await expect(
        page.getByText(
          'פתיחת האפליקציה אינה נחשבת הצלחה.',
        ),
      ).toBeVisible()

      await page
        .getByRole('button', {
          name: 'התחלת הפיילוט עכשיו',
        })
        .click()

      await expect(
        page.getByText('הפיילוט פעיל'),
      ).toBeVisible()
      await expect(
        page.getByText(
          'הפיילוט התחיל. השבוע הראשון פתוח לתיעוד קצר.',
        ),
      ).toBeVisible()
      expect(
        api.getStartRequestCount(),
      ).toBe(1)

      const weekOne = page
        .locator('.pilot-week')
        .filter({ hasText: 'שבוע 1' })

      await expect(weekOne).toHaveClass(
        /pilot-week-current/,
      )

      api.recordWeekOneActivity({
        contributionCount: 1,
        familyQuestionCount: 1,
      })

      await page
        .getByRole('button', {
          name: 'רענון ההתקדמות',
        })
        .click()

      const contributionGate = page
        .locator('.pilot-gate')
        .filter({ hasText: 'תיעוד חוזר' })
      const familyReturnGate = page
        .locator('.pilot-gate')
        .filter({ hasText: 'חזרת המשפחה' })
      const questionWeeksGate = page
        .locator('.pilot-gate')
        .filter({ hasText: 'שיחה מתמשכת' })

      await expect(
        contributionGate,
      ).toContainText('1 מתוך 3 שבועות')
      await expect(
        familyReturnGate,
      ).toContainText('היעד הושלם')
      await expect(
        questionWeeksGate,
      ).toContainText('1 מתוך 2 שבועות')

      api.recordWeekOneActivity({
        contributionCount: 1,
        familyQuestionCount: 2,
      })

      await page
        .getByRole('button', {
          name: 'רענון ההתקדמות',
        })
        .click()

      const weekOneQuestions = weekOne
        .locator('dl > div')
        .filter({
          hasText: 'שאלות משפחה',
        })

      await expect(
        weekOneQuestions.locator('dd'),
      ).toHaveText('2')
      await expect(
        questionWeeksGate,
      ).toContainText('1 מתוך 2 שבועות')

      await page.reload()

      await expect(
        page.getByText('הפיילוט פעיל'),
      ).toBeVisible()
      await expect(
        page.getByText('3', {
          exact: true,
        }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', {
          name: 'התחלת הפיילוט עכשיו',
        }),
      ).toHaveCount(0)

      page.once('dialog', (dialog) =>
        dialog.accept(),
      )

      await page
        .getByRole('button', {
          name:
            'הפסקת השתתפות בפיילוט',
        })
        .click()

      await expect(
        page.getByText(
          'ההשתתפות בפיילוט הופסקה. תוכן הארכיון נשאר ללא שינוי.',
        ),
      ).toBeVisible()
      await expect(
        page.getByText(
          'ההשתתפות הופסקה',
          { exact: true },
        ),
      ).toBeVisible()
      await expect(
        page.getByRole('button', {
          name:
            'הפסקת השתתפות בפיילוט',
        }),
      ).toHaveCount(0)
    })

    test('viewer can inspect the program but cannot start or withdraw it', async ({
      page,
    }) => {
      await installPilotApiMock(page, {
        canManage: false,
      })

      await page.goto(
        `/app/memories/${MEMORY_ID}/pilot`,
      )

      await expect(
        page.getByText(
          'בעל הארכיון או הנאמן המשפחתי יכולים להתחיל את המסלול.',
        ),
      ).toBeVisible()
      await expect(
        page.getByRole('button', {
          name: 'התחלת הפיילוט עכשיו',
        }),
      ).toHaveCount(0)
      await expect(
        page.getByRole('button', {
          name:
            'הפסקת השתתפות בפיילוט',
        }),
      ).toHaveCount(0)
    })
  },
)
