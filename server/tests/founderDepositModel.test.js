import {
  describe,
  expect,
  it,
} from 'vitest'
import FounderDeposit, {
  FOUNDER_DEPOSIT_AMOUNT_MINOR,
  FOUNDER_DEPOSIT_CURRENCY,
  FOUNDER_DEPOSIT_VERSION,
} from '../src/modules/pricingPilot/FounderDeposit.js'

const memoryId =
  '507f1f77bcf86cd799439010'
const ownerUserId =
  '507f1f77bcf86cd799439011'
const adminUserId =
  '507f1f77bcf86cd799439012'
const offeredAt = new Date(
  '2026-08-26T10:00:00.000Z',
)

function createDeposit(overrides = {}) {
  return new FounderDeposit({
    memoryId,
    ownerUserId,
    participantCode:
      'A1B2C3D4E5F60718',
    version: FOUNDER_DEPOSIT_VERSION,
    amountMinor:
      FOUNDER_DEPOSIT_AMOUNT_MINOR,
    currency: FOUNDER_DEPOSIT_CURRENCY,
    status: 'offered',
    offeredAt,
    statusHistory: [
      {
        event: 'offered',
        actorType: 'owner',
        actorUserId: ownerUserId,
        occurredAt: offeredAt,
      },
    ],
    ...overrides,
  })
}

describe('Founder deposit model', () => {
  it('stores a fixed offer without exposing private identifiers or evidence', async () => {
    const deposit = createDeposit({
      status: 'paid',
      interestedAt: offeredAt,
      paidAt: offeredAt,
      paymentEvidence: {
        referenceHash: 'a'.repeat(64),
        verifiedByUserId: adminUserId,
        verifiedAt: offeredAt,
      },
    })

    await deposit.validate()

    const publicDeposit = deposit.toJSON()

    expect(publicDeposit).toMatchObject({
      participantCode:
        'A1B2C3D4E5F60718',
      amountMinor: 4900,
      currency: 'USD',
      status: 'paid',
    })
    expect(publicDeposit)
      .not.toHaveProperty('memoryId')
    expect(publicDeposit)
      .not.toHaveProperty('ownerUserId')
    expect(publicDeposit)
      .not.toHaveProperty('paymentEvidence')
    expect(publicDeposit)
      .not.toHaveProperty('statusHistory')
  })

  it('requires verified evidence for a paid deposit', async () => {
    const deposit = createDeposit({
      status: 'paid',
      interestedAt: offeredAt,
      paidAt: offeredAt,
    })

    await expect(
      deposit.validate(),
    ).rejects.toMatchObject({
      errors: {
        paidAt: expect.anything(),
      },
    })
  })

  it('requires refund evidence only for a refunded deposit', async () => {
    const deposit = createDeposit({
      status: 'paid',
      interestedAt: offeredAt,
      paidAt: offeredAt,
      paymentEvidence: {
        referenceHash: 'b'.repeat(64),
        verifiedByUserId: adminUserId,
        verifiedAt: offeredAt,
      },
      refundedAt: offeredAt,
      refundEvidence: {
        referenceHash: 'c'.repeat(64),
        verifiedByUserId: adminUserId,
        verifiedAt: offeredAt,
      },
    })

    await expect(
      deposit.validate(),
    ).rejects.toMatchObject({
      errors: {
        refundedAt: expect.anything(),
      },
    })
  })
})
