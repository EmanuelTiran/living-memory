import {
  expect,
  test,
} from '@playwright/test'

const MEMORY_ID =
  '507f1f77bcf86cd799439020'
const PROFILE_PATH =
  `/app/memories/${MEMORY_ID}`

function createProfile(role = 'owner') {
  return {
    id: MEMORY_ID,
    subjectName: 'אורה',
    subjectGender: 'female',
    relationship: 'סבתא',
    description: 'אורה אהבה לספר על ירושלים ועל ארוחות השבת של המשפחה.',
    createdAt: '2026-08-01T09:00:00.000Z',
    portraitAssetId: null,
    authorization: {
      accessType: role === 'owner'
        ? 'owner'
        : 'membership',
      role,
      permission: 'chat',
    },
  }
}

function createStory({
  id,
  title,
  content,
  status = 'approved',
  occurredOn,
}) {
  return {
    id,
    title,
    content,
    status,
    occurredOn,
    createdAt: '2026-08-02T09:00:00.000Z',
    updatedAt: '2026-08-02T09:00:00.000Z',
    revision: 1,
    revisionHistory: [],
  }
}

async function fulfillJson(route, payload) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  })
}

async function installMemoryProfileApiMock(
  page,
  {
    role = 'owner',
    stories = [],
  } = {},
) {
  let currentRole = role

  await page.route(
    '**/api/**',
    async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const method = request.method()
      const { pathname } = url

      if (!pathname.startsWith('/api/')) {
        await route.continue()
        return
      }

      if (
        pathname === '/api/auth/refresh' &&
        method === 'POST'
      ) {
        await fulfillJson(route, {
          success: true,
          data: {
            accessToken: 'memory-profile-e2e-token',
            user: {
              id: '507f1f77bcf86cd799439021',
              displayName: 'בדיקת פרופיל',
              email: 'profile-e2e@example.test',
              systemRole: 'user',
            },
          },
        })
        return
      }

      if (
        pathname ===
          `/api/family-access/memories/${MEMORY_ID}` &&
        method === 'GET'
      ) {
        await fulfillJson(route, {
          success: true,
          data: {
            memoryProfile: createProfile(currentRole),
          },
        })
        return
      }

      if (
        pathname ===
          `/api/family-access/memories/${MEMORY_ID}/stories` &&
        method === 'GET'
      ) {
        await fulfillJson(route, {
          success: true,
          data: {
            memoryStories: stories,
          },
        })
        return
      }

      if (
        pathname ===
          `/api/memories/${MEMORY_ID}/assets` &&
        method === 'GET'
      ) {
        await fulfillJson(route, {
          success: true,
          data: { assets: [] },
        })
        return
      }

      if (
        pathname ===
          `/api/memories/${MEMORY_ID}/recordings` &&
        method === 'GET'
      ) {
        await fulfillJson(route, {
          success: true,
          data: { recordings: [] },
        })
        return
      }

      if (
        pathname ===
          `/api/memories/${MEMORY_ID}/family-questions` &&
        method === 'GET'
      ) {
        await fulfillJson(route, {
          success: true,
          data: { familyQuestions: [] },
        })
        return
      }

      if (
        pathname ===
          `/api/memories/${MEMORY_ID}/biography/questionnaire` &&
        method === 'GET'
      ) {
        await fulfillJson(route, {
          success: true,
          data: {
            questionnaire: {
              progress: {
                completedCount: 0,
                isComplete: false,
              },
              answers: [],
            },
          },
        })
        return
      }

      if (
        pathname ===
          `/api/memories/${MEMORY_ID}/archive-search` &&
        method === 'GET'
      ) {
        await fulfillJson(route, {
          success: true,
          data: {
            search: {
              results: [],
              total: 0,
              limit: 30,
            },
          },
        })
        return
      }

      if (
        pathname ===
          `/api/memories/${MEMORY_ID}/timeline` &&
        method === 'GET'
      ) {
        await fulfillJson(route, {
          success: true,
          data: {
            timeline: {
              datedEntries: [],
              undatedEntries: [],
              totalCount: 0,
            },
          },
        })
        return
      }

      if (
        pathname ===
          `/api/memories/${MEMORY_ID}/recordings/stories` &&
        method === 'GET'
      ) {
        await fulfillJson(route, {
          success: true,
          data: { stories: [] },
        })
        return
      }

      await fulfillJson(route, {
        success: true,
        data: {},
      })
    },
  )

  return {
    setRole(nextRole) {
      currentRole = nextRole
    },
  }
}

async function expectSelectedTab(page, name) {
  await expect(
    page.getByRole('tab', { name }),
  ).toHaveAttribute('aria-selected', 'true')
}

test.describe('Memory profile information architecture', () => {
  test('guides a new archive and keeps tab navigation role-safe', async ({
    page,
  }) => {
    const api = await installMemoryProfileApiMock(page)

    await page.goto(PROFILE_PATH)

    await expectSelectedTab(page, 'היום')
    await expect(
      page.getByRole('heading', {
        name: 'הארכיון של אורה נפתח',
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', {
        name: 'התחלת שיחה ראשונה',
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', {
        name: /חיפוש בארכיון של אורה/,
      }),
    ).not.toBeVisible()
    await expect(
      page.getByRole('heading', {
        name: /ציר הזמן של אורה/,
      }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('heading', {
        name: /מפת הסיפורים של אורה/,
      }),
    ).toHaveCount(0)

    await page.getByRole('tab', {
      name: 'שאלות ומשפחה',
    }).click()
    await expect(
      page.getByRole('heading', {
        name: 'השיחה תיפתח אחרי אישור המקור הראשון',
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', {
        name: 'שאלת שאלה ראשונה',
      }),
    ).toHaveCount(0)

    await page.getByRole('tab', {
      name: 'תיעוד',
    }).click()
    await expectSelectedTab(page, 'תיעוד')
    await expect(page).toHaveURL(/\?tab=documentation$/)

    await page.goBack()
    await expectSelectedTab(page, 'שאלות ומשפחה')
    await page.goForward()
    await expectSelectedTab(page, 'תיעוד')
    await page.reload()
    await expectSelectedTab(page, 'תיעוד')

    api.setRole('viewer')
    await page.goto(`${PROFILE_PATH}?tab=documentation`)
    await expectSelectedTab(page, 'היום')
    await expect(page).toHaveURL(/\?tab=today$/)
    await expect(
      page.getByText(
        'התיעוד אינו זמין בהרשאת צפייה; הועברתם לעמוד היום.',
      ),
    ).toBeVisible()
    await expect(
      page.getByRole('tab', {
        name: 'תיעוד',
      }),
    ).toHaveCount(0)
  })

  test('navigates a populated archive, opens stories, and preserves history', async ({
    page,
  }) => {
    await installMemoryProfileApiMock(page, {
      stories: [
        createStory({
          id: 'story-1',
          title: 'הדרך לבית הספר',
          content: 'אורה הלכה בכל בוקר לבית הספר עם אחותה, דרך השוק הישן בירושלים.',
          occurredOn: '1954-09-01',
        }),
        createStory({
          id: 'story-2',
          title: 'ארוחות שבת',
          content: 'בכל יום שישי אורה בישלה למשפחה ארוחה גדולה, עם שירים וסיפורים סביב השולחן.',
          status: 'draft',
          occurredOn: '1978-05-12',
        }),
        createStory({
          id: 'story-3',
          title: 'הגינה הקטנה',
          content: 'בגינה הקטנה ליד הבית אורה גידלה נענע, ורדים ועגבניות לכל הנכדים.',
        }),
      ],
    })

    await page.goto(PROFILE_PATH)
    await expectSelectedTab(page, 'היום')

    const todayTab = page.getByRole('tab', {
      name: 'היום',
    })
    await todayTab.focus()
    await todayTab.press('ArrowLeft')
    await expectSelectedTab(page, 'תיעוד')
    await expect(
      page.getByRole('tab', {
        name: 'תיעוד',
      }),
    ).toBeFocused()

    await page.getByRole('tab', {
      name: 'הארכיון',
    }).click()
    await expectSelectedTab(page, 'הארכיון')
    await expect(page).toHaveURL(/\?tab=archive$/)
    await expect(
      page.getByRole('heading', {
        name: 'הסיפורים שנשמרו',
      }),
    ).toBeVisible()

    const firstStory = page.locator(
      '#memory-story-story-1 details',
    )
    await expect(firstStory).not.toHaveAttribute('open', '')
    await firstStory.getByText(
      'פתיחת הסיפור והפעולות',
    ).click()
    await expect(firstStory).toHaveAttribute('open', '')
    await expect(firstStory).toContainText(
      'אורה הלכה בכל בוקר לבית הספר עם אחותה',
    )
    await expect(
      firstStory.getByRole('button', {
        name: 'עריכת הסיפור',
      }),
    ).toBeVisible()

    await page.goto(
      `${PROFILE_PATH}?tab=archive&source=profile-e2e#memory-story-story-2`,
    )
    const directStory = page.locator(
      '#memory-story-story-2',
    )
    await expect(
      directStory.locator('details'),
    ).toHaveAttribute('open', '')
    await expect(directStory).toBeFocused()

    await page.getByRole('tab', {
      name: 'ציר זמן',
    }).click()
    await expect(page).toHaveURL(
      /\?tab=archive&source=profile-e2e&archiveView=timeline#memory-timeline-title$/,
    )

    await page.goBack()
    await expect(page).toHaveURL(
      /\?tab=archive&source=profile-e2e#memory-story-story-2$/,
    )
    await page.goForward()
    await expectSelectedTab(page, 'הארכיון')
    await expect(
      page.getByRole('tab', {
        name: 'ציר זמן',
      }),
    ).toHaveAttribute('aria-selected', 'true')

    await page.getByRole('tab', {
      name: 'שאלות ומשפחה',
    }).click()
    await expectSelectedTab(page, 'שאלות ומשפחה')
  })
})
