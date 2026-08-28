import FounderDeposit, {
  FOUNDER_DEPOSIT_AMOUNT_MINOR,
  FOUNDER_DEPOSIT_CURRENCY,
} from '../pricingPilot/FounderDeposit.js'
import {
  PRICING_PILOT_RESEARCH_GATE,
} from '../pricingPilot/pricingPilotDefinition.js'

function calculateRate(
  numerator,
  denominator,
) {
  if (denominator === 0) {
    return null
  }

  return Number(
    ((numerator / denominator) * 100)
      .toFixed(1),
  )
}

function getEvidenceStatus(
  offered,
  depositRatePercent,
) {
  if (
    offered <
    PRICING_PILOT_RESEARCH_GATE
      .qualifiedOffers
  ) {
    return 'collecting'
  }

  if (
    depositRatePercent >=
    PRICING_PILOT_RESEARCH_GATE
      .successRatePercent
  ) {
    return 'success'
  }

  if (
    depositRatePercent <
    PRICING_PILOT_RESEARCH_GATE
      .pivotBelowPercent
  ) {
    return 'pivot'
  }

  return 'inconclusive'
}

export async function getPricingPilotOverview(
  now = new Date(),
) {
  if (
    !(now instanceof Date) ||
    Number.isNaN(now.getTime())
  ) {
    throw new TypeError(
      'Pricing pilot overview timestamp must be valid.',
    )
  }

  const [
    offered,
    interested,
    awaitingPayment,
    declined,
    verifiedPayments,
    currentlyPaid,
    refunded,
  ] = await Promise.all([
    FounderDeposit.countDocuments({}),
    FounderDeposit.countDocuments({
      interestedAt: {
        $ne: null,
      },
    }),
    FounderDeposit.countDocuments({
      status: 'interested',
    }),
    FounderDeposit.countDocuments({
      status: 'declined',
    }),
    FounderDeposit.countDocuments({
      paidAt: {
        $ne: null,
      },
    }),
    FounderDeposit.countDocuments({
      status: 'paid',
    }),
    FounderDeposit.countDocuments({
      status: 'refunded',
    }),
  ])

  const interestRatePercent =
    calculateRate(interested, offered)
  const depositRatePercent =
    calculateRate(
      verifiedPayments,
      offered,
    )

  return {
    generatedAt: now.toISOString(),
    privacy: {
      containsPrivateContent: false,
      scope:
        'aggregate_pricing_pilot_metadata_only',
    },
    offer: {
      amountMinor:
        FOUNDER_DEPOSIT_AMOUNT_MINOR,
      currency:
        FOUNDER_DEPOSIT_CURRENCY,
      refundable: true,
      recurringCharge: false,
    },
    funnel: {
      offered,
      interested,
      awaitingPayment,
      declined,
      verifiedPayments,
      currentlyPaid,
      refunded,
      interestRatePercent,
      depositRatePercent,
    },
    economics: {
      collectedMinor:
        verifiedPayments *
        FOUNDER_DEPOSIT_AMOUNT_MINOR,
      refundedMinor:
        refunded *
        FOUNDER_DEPOSIT_AMOUNT_MINOR,
      retainedMinor:
        currentlyPaid *
        FOUNDER_DEPOSIT_AMOUNT_MINOR,
      currency:
        FOUNDER_DEPOSIT_CURRENCY,
    },
    researchGate: {
      ...PRICING_PILOT_RESEARCH_GATE,
      evidenceStatus:
        getEvidenceStatus(
          offered,
          depositRatePercent,
        ),
    },
  }
}
