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

async function expectCredentialForm(page, mode) {
  const form = page.locator(`#${mode}-form`)
  await expect(form).toHaveAttribute('name', mode)
  await expect(form).not.toHaveAttribute('autocomplete', 'off')

  const email = form.getByLabel('כתובת אימייל')
  await expect(email).toHaveAttribute('type', 'email')
  await expect(email).toHaveAttribute('name', 'email')
  await expect(email).toHaveAttribute('autocomplete', 'email')

  const password = form.getByLabel('סיסמה')
  await expect(password).toHaveAttribute('type', 'password')
  await expect(password).toHaveAttribute('name', 'password')
  await expect(password).toHaveAttribute(
    'autocomplete',
    mode === 'register' ? 'new-password' : 'current-password',
  )
  await expect(form.locator('button[type="submit"]')).toBeVisible()
}

async function completePasswordLogin(page) {
  await expectCredentialForm(page, 'login')
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
    await expectCredentialForm(page, 'register')
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

test.describe('Password recovery autofill', () => {
  test('submits the recovery email with standard autofill metadata', async ({ page }) => {
    await installApiMock(page)
    const requests = []
    await page.route('**/api/auth/forgot-password', async (route) => {
      requests.push(route.request().postDataJSON())
      await fulfillJson(route, { success: true, data: null })
    })
    await page.goto('/forgot-password')
    const email = page.getByLabel('כתובת אימייל')
    await expect(email).toHaveAttribute('type', 'email')
    await expect(email).toHaveAttribute('name', 'email')
    await expect(email).toHaveAttribute('autocomplete', 'email')
    await email.fill('family@example.test')
    await page.locator('.auth-form button[type="submit"]').click()
    await expect(page.getByRole('status')).toBeVisible()
    expect(requests).toEqual([{ email: 'family@example.test' }])
  })

  test('marks both reset fields as new passwords and preserves confirmation validation', async ({ page }) => {
    await installApiMock(page)
    const requests = []
    await page.route('**/api/auth/reset-password', async (route) => {
      requests.push(route.request().postDataJSON())
      await fulfillJson(route, { success: true, data: null })
    })
    const token = 'a'.repeat(43)
    await page.goto(`/reset-password?token=${token}`)
    const form = page.locator('.auth-form')
    const password = form.locator('input[name="password"]')
    const confirmation = form.locator('input[name="passwordConfirmation"]')
    for (const field of [password, confirmation]) {
      await expect(field).toHaveAttribute('type', 'password')
      await expect(field).toHaveAttribute('autocomplete', 'new-password')
    }
    await expect(form).not.toHaveAttribute('autocomplete', 'off')
    await password.fill('correct-password-long')
    await confirmation.fill('different-password-long')
    await form.locator('button[type="submit"]').click()
    await expect(page.getByRole('alert')).toHaveText('הסיסמאות אינן זהות.')
    expect(requests).toEqual([])
    await confirmation.fill('correct-password-long')
    await form.locator('button[type="submit"]').click()
    await expect(page.getByRole('heading', { name: 'הסיסמה עודכנה בהצלחה' })).toBeVisible()
    expect(requests).toEqual([{ token, password: 'correct-password-long' }])
    await page.getByRole('link', { name: 'כניסה לחשבון', exact: true }).click()
    await expectCredentialForm(page, 'login')
  })

  test('rejects a reset link without a valid token', async ({ page }) => {
    await installApiMock(page)
    await page.goto('/reset-password?token=invalid')
    await expect(page.getByRole('heading', { name: 'קישור איפוס לא תקין' })).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
  })
})
