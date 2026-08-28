import { getAdminOverview } from './adminOverviewService.js'
import { getPilotOverview } from './pilotOverviewService.js'
import { getPricingPilotOverview } from './pricingPilotOverviewService.js'
import { recordFounderPaymentAction } from '../pricingPilot/founderDepositPaymentService.js'

export async function showAdminOverview(
  _req,
  res,
) {
  const overview = await getAdminOverview()

  res.status(200).json({
    success: true,
    data: {
      overview,
    },
  })
}

export async function showPilotOverview(
  _req,
  res,
) {
  const pilot = await getPilotOverview()

  res.status(200).json({
    success: true,
    data: {
      pilot,
    },
  })
}

export async function showPricingPilotOverview(
  _req,
  res,
) {
  const pricingPilot =
    await getPricingPilotOverview()

  res.status(200).json({
    success: true,
    data: {
      pricingPilot,
    },
  })
}

export async function updatePricingParticipant(
  req,
  res,
) {
  const participant =
    await recordFounderPaymentAction(
      req.auth.userId,
      req.validatedParams.participantCode,
      req.validatedBody,
    )

  res.status(200).json({
    success: true,
    data: {
      participant,
    },
  })
}
