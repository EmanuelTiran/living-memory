import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  countDocuments: vi.fn(),
}))

vi.mock(
  '../src/modules/pricingPilot/FounderDeposit.js',
  () => ({
    FOUNDER_DEPOSIT_AMOUNT_MINOR: 4900,
    FOUNDER_DEPOSIT_CURRENCY: 'USD',
    default: {
      countDocuments:
        mocks.countDocuments,
    },
  }),
)

import { getPricingPilotOverview } from '../src/modules/admin/pricingPilotOverviewService.js'

describe('Pricing pilot overview service', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.countDocuments
      .mockImplementation((query) => {
        if (Object.keys(query).length === 0) {
          return 40
        }

        if (query.interestedAt) {
          return 12
        }

        if (query.paidAt) {
          return 8
        }

        return {
          interested: 4,
          declined: 20,
          paid: 6,
          refunded: 2,
        }[query.status] ?? 0
      })
  })

  it('counts only verified payments as willingness-to-pay evidence', async () => {
    const overview =
      await getPricingPilotOverview(
        new Date(
          '2026-08-26T12:00:00.000Z',
        ),
      )

    expect(overview.funnel).toEqual({
      offered: 40,
      interested: 12,
      awaitingPayment: 4,
      declined: 20,
      verifiedPayments: 8,
      currentlyPaid: 6,
      refunded: 2,
      interestRatePercent: 30,
      depositRatePercent: 20,
    })
    expect(overview.economics).toEqual({
      collectedMinor: 39200,
      refundedMinor: 9800,
      retainedMinor: 29400,
      currency: 'USD',
    })
    expect(
      overview.researchGate.evidenceStatus,
    ).toBe('success')
    expect(overview.privacy).toEqual({
      containsPrivateContent: false,
      scope:
        'aggregate_pricing_pilot_metadata_only',
    })
  })

  it('keeps the gate in collection mode before the qualified sample size', async () => {
    mocks.countDocuments
      .mockResolvedValue(0)

    const overview =
      await getPricingPilotOverview()

    expect(
      overview.funnel.depositRatePercent,
    ).toBe(null)
    expect(
      overview.researchGate.evidenceStatus,
    ).toBe('collecting')
  })

  it('rejects invalid reporting timestamps', async () => {
    await expect(
      getPricingPilotOverview(
        new Date('invalid'),
      ),
    ).rejects.toThrow(
      'Pricing pilot overview timestamp must be valid.',
    )
  })
})
