import {
  expect,
  test,
} from '@playwright/test'

const MEMORY_ID =
  '507f1f77bcf86cd799439010'
const PRICING_PATH =
  `/api/memories/${MEMORY_ID}/pricing-pilot`
const PARTICIPANT_CODE =
  'A1B2C3D4E5F60718'
const OFFERED_AT =
  '2026-08-26T10:00:00.000Z'

const program = {
  version: 'founder-deposit-pilot-v1',
  amountMinor: 4900,
  currency: 'USD',
  refundable: true,
  recurringCharge: false,
  paymentCollection:
    'concierge_external_only',
  researchGate: {
    qualifiedOffers: 40,
    successRatePercent: 20,
    pivotBelowPercent: 8,
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

async function installPricingApiMock(page) {
  let deposit = null
  let offerCount = 0

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
              'pricing-e2e-access-token',
            user: {
              id:
                '507f1f77bcf86cd799439011',
              displayName:
                'בדיקת תמחור',
              email:
                'pricing-e2e@example.test',
              systemRole: 'user',
            },
          },
        })
        return
      }

      if (
        url.pathname === PRICING_PATH &&
        method === 'GET'
      ) {
        await fulfillJson(route, {
          success: true,
          data: {
            pricingPilot: {
              program,
              eligibility: {
                eligible: true,
                reason: null,
              },
              deposit,
            },
          },
        })
        return
      }

      if (
        url.pathname ===
          `${PRICING_PATH}/offer` &&
        method === 'POST'
      ) {
        offerCount += 1
        deposit = {
          participantCode:
            PARTICIPANT_CODE,
          version: program.version,
          amountMinor:
            program.amountMinor,
          currency: program.currency,
          status: 'offered',
          offeredAt: OFFERED_AT,
          interestedAt: null,
          declinedAt: null,
          paidAt: null,
          refundedAt: null,
          paymentVerified: false,
        }

        await fulfillJson(
          route,
          {
            success: true,
            data: {
              pricingPilot: {
                created: true,
                program,
                deposit,
              },
            },
          },
          201,
        )
        return
      }

      if (
        url.pathname ===
          `${PRICING_PATH}/decision` &&
        method === 'PATCH'
      ) {
        const body = request.postDataJSON()

        deposit = {
          ...deposit,
          status: body.decision,
          interestedAt:
            body.decision === 'interested'
              ? '2026-08-26T10:05:00.000Z'
              : deposit.interestedAt,
          declinedAt:
            body.decision === 'declined'
              ? '2026-08-26T10:05:00.000Z'
              : null,
        }

        await fulfillJson(route, {
          success: true,
          data: {
            pricingPilot: {
              program,
              deposit,
            },
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
    getOfferCount() {
      return offerCount
    },
  }
}

test.describe(
  'Founder pricing pilot',
  () => {
    test('separates interest from payment evidence and persists after refresh', async ({
      page,
    }) => {
      const api =
        await installPricingApiMock(page)

      await page.goto(
        `/app/memories/${MEMORY_ID}/pricing-pilot`,
      )

      await expect(
        page.getByRole('heading', {
          name:
            'קבוצת המייסדים של זיכרון חי',
        }),
      ).toBeVisible()
      await expect(
        page.getByText(
          'אין גביית כרטיס במסך הזה',
        ),
      ).toBeVisible()

      await page
        .getByRole('button', {
          name: 'פתיחת הצעת המייסדים',
        })
        .click()

      expect(api.getOfferCount()).toBe(1)
      await expect(
        page.getByText(PARTICIPANT_CODE),
      ).toBeVisible()
      await expect(
        page.getByText('ההצעה הוצגה'),
      ).toBeVisible()

      await page
        .getByRole('button', {
          name: 'מעוניין להצטרף',
        })
        .click()

      await expect(
        page.getByText(
          'ממתין לאימות תשלום',
        ),
      ).toBeVisible()
      await expect(
        page.getByText(
          'העניין נרשם. זה עדיין אינו תשלום; לאחר תשלום חיצוני מנהל הפיילוט יאמת אותו.',
        ),
      ).toBeVisible()
      await expect(
        page.getByText(
          'הפיקדון שולם ואומת',
        ),
      ).toHaveCount(0)

      await page.reload()

      await expect(
        page.getByText(PARTICIPANT_CODE),
      ).toBeVisible()
      await expect(
        page.getByText(
          'ממתין לאימות תשלום',
        ),
      ).toBeVisible()
      expect(api.getOfferCount()).toBe(1)
    })
  },
)
