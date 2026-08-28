import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  requireMemoryPermission: vi.fn(),
  enrollmentFindOne: vi.fn(),
}))

vi.mock(
  '../src/modules/memories/memoryAccessService.js',
  () => ({
    MEMORY_PERMISSIONS: {
      MANAGE: 'manage',
    },
    requireMemoryPermission:
      mocks.requireMemoryPermission,
  }),
)

vi.mock(
  '../src/modules/memories/MemoryPilotEnrollment.js',
  () => ({
    default: {
      findOne: mocks.enrollmentFindOne,
    },
  }),
)

import FounderDeposit from '../src/modules/pricingPilot/FounderDeposit.js'
import {
  getPricingPilot,
  recordFounderDecision,
} from '../src/modules/pricingPilot/pricingPilotService.js'
import { recordFounderPaymentAction } from '../src/modules/pricingPilot/founderDepositPaymentService.js'

const memoryId =
  '507f1f77bcf86cd799439010'
const ownerUserId =
  '507f1f77bcf86cd799439011'
const adminUserId =
  '507f1f77bcf86cd799439012'
const participantCode =
  'A1B2C3D4E5F60718'
const offeredAt = new Date(
  '2026-08-26T10:00:00.000Z',
)

function createDeposit(overrides = {}) {
  const deposit = new FounderDeposit({
    memoryId,
    ownerUserId,
    participantCode,
    version: 'founder-deposit-pilot-v1',
    amountMinor: 4900,
    currency: 'USD',
    status: 'offered',
    offeredAt,
    statusHistory: [],
    ...overrides,
  })

  deposit.save = vi.fn()
    .mockResolvedValue(deposit)

  return deposit
}

describe('Pricing pilot service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()

    mocks.requireMemoryPermission
      .mockResolvedValue({
        memoryProfile: {
          _id: memoryId,
        },
        authorization: {
          role: 'owner',
        },
      })
    mocks.enrollmentFindOne
      .mockResolvedValue({
        memoryId,
        status: 'active',
      })
  })

  it('shows eligibility without creating a financial record on read', async () => {
    const findOne = vi
      .spyOn(FounderDeposit, 'findOne')
      .mockResolvedValue(null)

    const result = await getPricingPilot(
      ownerUserId,
      memoryId,
    )

    expect(result.eligibility).toEqual({
      eligible: true,
      reason: null,
    })
    expect(result.deposit).toBe(null)
    expect(result.program).toMatchObject({
      amountMinor: 4900,
      currency: 'USD',
      refundable: true,
      recurringCharge: false,
    })
    expect(findOne)
      .toHaveBeenCalledTimes(1)
  })

  it('records interest without marking the deposit as paid', async () => {
    const deposit = createDeposit()

    vi.spyOn(FounderDeposit, 'findOne')
      .mockResolvedValue(deposit)

    const now = new Date(
      '2026-08-26T11:00:00.000Z',
    )
    const result =
      await recordFounderDecision(
        ownerUserId,
        memoryId,
        'interested',
        now,
      )

    expect(result.deposit).toMatchObject({
      status: 'interested',
      interestedAt: now.toISOString(),
      paidAt: null,
      paymentVerified: false,
    })
    expect(deposit.statusHistory.at(-1))
      .toMatchObject({
        event: 'interest_confirmed',
        actorType: 'owner',
      })
    expect(deposit.save)
      .toHaveBeenCalledTimes(1)
  })

  it('lets only the admin payment path create verified WTP evidence', async () => {
    const deposit = createDeposit({
      status: 'interested',
      interestedAt: offeredAt,
    })

    vi.spyOn(FounderDeposit, 'findOne')
      .mockResolvedValue(deposit)

    const now = new Date(
      '2026-08-26T12:00:00.000Z',
    )
    const result =
      await recordFounderPaymentAction(
        adminUserId,
        participantCode,
        {
          action: 'verify_payment',
          evidenceReference:
            'external-payment-1234',
        },
        now,
      )

    expect(result).toMatchObject({
      status: 'paid',
      paidAt: now.toISOString(),
      paymentVerified: true,
    })
    expect(
      deposit.paymentEvidence.referenceHash,
    ).toMatch(/^[a-f0-9]{64}$/)
    expect(deposit.paymentEvidence)
      .not.toHaveProperty(
        'evidenceReference',
      )
    expect(deposit.statusHistory.at(-1))
      .toMatchObject({
        event: 'payment_verified',
        actorType: 'admin',
      })
  })

  it('rejects a refund before a payment has been verified', async () => {
    const deposit = createDeposit({
      status: 'interested',
      interestedAt: offeredAt,
    })

    vi.spyOn(FounderDeposit, 'findOne')
      .mockResolvedValue(deposit)

    await expect(
      recordFounderPaymentAction(
        adminUserId,
        participantCode,
        {
          action: 'record_refund',
          evidenceReference:
            'external-refund-1234',
        },
      ),
    ).rejects.toMatchObject({
      code:
        'FOUNDER_DEPOSIT_PAYMENT_STATE_INVALID',
    })
  })
})
