import {
  expect,
  test,
} from '@playwright/test'

const INVITATION_TOKEN =
  'invitation-token-for-navigation-test'
const MEMORY_ID =
  '507f1f77bcf86cd799439010'
const INVITATION_PATH =
  `/invitation#token=${INVITATION_TOKEN}`

const authentication = {
  accessToken: 'invitation-e2e-access-token',
  user: {
    id: '507f1f77bcf86cd799439011',
    displayName: 'בן משפחה',
    email: 'family@example.test',
    systemRole: 'user',
  },
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

async function installApiMock(
  page,
  {
    authenticatedAtStart = false,
    invalidInvitation = false,
  } = {},
) {
  let authenticated = authenticatedAtStart
  const registrationBodies = []
  const acceptanceBodies = []

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()

    if (!url.pathname.startsWith('/api/')) {
      await route.continue()
      return
    }

    if (
      url.pathname === '/api/auth/refresh' &&
      method === 'POST'
    ) {
      if (authenticated) {
        await fulfillJson(route, {
          success: true,
          data: authentication,
        })
      } else {
        await fulfillJson(
          route,
          {
            success: false,
            error: {
              code: 'INVALID_REFRESH_TOKEN',
              message: 'No active session.',
            },
          },
          401,
        )
      }
      return
    }

    if (
      url.pathname ===
        '/api/family-access/invitations/preview' &&
      method === 'POST'
    ) {
      if (invalidInvitation) {
        await fulfillJson(
          route,
          {
            success: false,
            error: {
              code:
                'MEMORY_INVITATION_UNAVAILABLE',
              message:
                'Invitation is unavailable.',
            },
          },
          404,
        )
      } else {
        await fulfillJson(route, {
          success: true,
          data: {
            invitation: {
              subjectName: 'רות',
              role: 'contributor',
              invitedEmailHint:
                'fa****@example.test',
              expiresAt:
                '2026-09-28T10:00:00.000Z',
              consentPolicyVersion:
                'memory-participation-v1',
            },
          },
        })
      }
      return
    }

    if (
      url.pathname === '/api/auth/register' &&
      method === 'POST'
    ) {
      registrationBodies.push(
        request.postDataJSON(),
      )
      await fulfillJson(
        route,
        {
          success: true,
          data: null,
        },
        201,
      )
      return
    }

    if (
      url.pathname === '/api/auth/login' &&
      method === 'POST'
    ) {
      authenticated = true
      await fulfillJson(route, {
        success: true,
        data: authentication,
      })
      return
    }

    if (
      url.pathname ===
        '/api/family-access/invitations/accept' &&
      method === 'POST'
    ) {
      acceptanceBodies.push(
        request.postDataJSON(),
      )
      await fulfillJson(route, {
        success: true,
        data: {
          memoryProfile: {
            id: MEMORY_ID,
            subjectName: 'רות',
          },
          consent: {
            policyVersion:
              'memory-participation-v1',
          },
        },
      })
      return
    }

    await fulfillJson(
      route,
      {
        success: false,
        error: {
          code: 'E2E_UNMOCKED_REQUEST',
          message:
            `${method} ${url.pathname} was not mocked.`,
        },
      },
      501,
    )
  })

  return {
    registrationBodies,
    acceptanceBodies,
  }
}

async function completePasswordLogin(page) {
  await page
    .getByLabel('כתובת אימייל')
    .fill('family@example.test')
  await page
    .getByLabel('סיסמה')
    .fill('correct-password')
  await page
    .getByRole('button', {
      name: 'כניסה',
      exact: true,
    })
    .click()
}

test.describe('Invitation authentication continuation', () => {
  test('preserves the invitation through login and shows consent immediately', async ({
    page,
  }) => {
    await installApiMock(page)
    await page.goto(INVITATION_PATH)

    await page
      .getByRole('link', {
        name: 'כניסה לחשבון',
      })
      .click()
    await completePasswordLogin(page)

    await expect(page).toHaveURL(
      new RegExp(
        `/invitation#token=${INVITATION_TOKEN}$`,
      ),
    )
    await expect(
      page.getByRole('heading', {
        name:
          'לפני הכניסה, חשוב להבין למה מסכימים',
      }),
    ).toBeVisible()
  })

  test('preserves the invitation through registration and first login', async ({
    page,
  }) => {
    const api = await installApiMock(page)
    await page.goto(INVITATION_PATH)

    await page
      .getByRole('link', {
        name: 'יצירת חשבון',
      })
      .click()
    await page
      .getByLabel('שם להצגה')
      .fill('בן משפחה')
    await page
      .getByLabel('כתובת אימייל')
      .fill('family@example.test')
    await page
      .getByLabel('סיסמה')
      .fill('correct-password-long')
    await page
      .getByRole('button', {
        name: 'יצירת החשבון',
      })
      .click()

    await expect(
      page.getByText('החשבון נוצר בהצלחה.'),
    ).toBeVisible()
    await completePasswordLogin(page)

    await expect(page).toHaveURL(
      new RegExp(
        `/invitation#token=${INVITATION_TOKEN}$`,
      ),
    )
    await expect(
      page.getByRole('heading', {
        name:
          'לפני הכניסה, חשוב להבין למה מסכימים',
      }),
    ).toBeVisible()
    expect(api.registrationBodies).toEqual([
      expect.objectContaining({
        invitationToken: INVITATION_TOKEN,
      }),
    ])
  })

  test('shows invitation consent immediately for an existing session', async ({
    page,
  }) => {
    await installApiMock(page, {
      authenticatedAtStart: true,
    })
    await page.goto(INVITATION_PATH)

    await expect(
      page.getByRole('heading', {
        name:
          'לפני הכניסה, חשוב להבין למה מסכימים',
      }),
    ).toBeVisible()
  })

  test('accepts consent and opens the invited memory', async ({
    page,
  }) => {
    const api = await installApiMock(page, {
      authenticatedAtStart: true,
    })
    await page.goto(INVITATION_PATH)

    const consentCheckboxes = page.locator(
      '.participation-consent input[type="checkbox"]',
    )

    await expect(consentCheckboxes)
      .toHaveCount(3)

    for (let index = 0; index < 3; index += 1) {
      await consentCheckboxes
        .nth(index)
        .check()
    }
    await page
      .getByRole('button', {
        name: 'אישור ההסכמה והצטרפות',
      })
      .click()

    await expect(page).toHaveURL(
      `/app/memories/${MEMORY_ID}`,
    )
    expect(api.acceptanceBodies).toEqual([
      {
        token: INVITATION_TOKEN,
        consent: {
          policyVersion:
            'memory-participation-v1',
          acceptsArchiveParticipation: true,
          acceptsRecordingAndTranscription: true,
          understandsGroundedAiUse: true,
        },
      },
    ])
  })

  test('keeps generic login behavior unchanged', async ({
    page,
  }) => {
    await installApiMock(page)
    await page.goto('/login')

    await completePasswordLogin(page)

    await expect(page).toHaveURL('/app')
  })

  test('keeps invalid invitation behavior unchanged', async ({
    page,
  }) => {
    await installApiMock(page, {
      invalidInvitation: true,
    })
    await page.goto(INVITATION_PATH)

    await expect(
      page.getByRole('alert'),
    ).toHaveText(
      'ההזמנה אינה זמינה, בוטלה או שפג תוקפה.',
    )
  })
})
