import {
  FOUNDER_DEPOSIT_AMOUNT_MINOR,
  FOUNDER_DEPOSIT_CURRENCY,
  FOUNDER_DEPOSIT_VERSION,
} from './FounderDeposit.js'

export const PRICING_PILOT_RESEARCH_GATE =
  Object.freeze({
    qualifiedOffers: 40,
    successRatePercent: 20,
    pivotBelowPercent: 8,
  })

export function createPricingProgramSummary() {
  return {
    version: FOUNDER_DEPOSIT_VERSION,
    amountMinor:
      FOUNDER_DEPOSIT_AMOUNT_MINOR,
    currency: FOUNDER_DEPOSIT_CURRENCY,
    refundable: true,
    recurringCharge: false,
    paymentCollection:
      'concierge_external_only',
    researchGate:
      PRICING_PILOT_RESEARCH_GATE,
  }
}

export function serializeFounderDeposit(
  deposit,
) {
  if (!deposit) {
    return null
  }

  return {
    participantCode:
      deposit.participantCode,
    version: deposit.version,
    amountMinor: deposit.amountMinor,
    currency: deposit.currency,
    status: deposit.status,
    offeredAt:
      deposit.offeredAt?.toISOString?.() ??
      null,
    interestedAt:
      deposit.interestedAt
        ?.toISOString?.() ?? null,
    declinedAt:
      deposit.declinedAt
        ?.toISOString?.() ?? null,
    paidAt:
      deposit.paidAt?.toISOString?.() ??
      null,
    refundedAt:
      deposit.refundedAt
        ?.toISOString?.() ?? null,
    paymentVerified: Boolean(
      deposit.paidAt &&
        deposit.paymentEvidence,
    ),
  }
}
