import {
  createFounderOffer,
  getPricingPilot,
  recordFounderDecision,
} from './pricingPilotService.js'

export async function showPricingPilot(
  req,
  res,
) {
  const pricingPilot =
    await getPricingPilot(
      req.auth.userId,
      req.validatedParams.memoryId,
    )

  res.status(200).json({
    success: true,
    data: {
      pricingPilot,
    },
  })
}

export async function offerFounderDeposit(
  req,
  res,
) {
  const result =
    await createFounderOffer(
      req.auth.userId,
      req.validatedParams.memoryId,
    )

  res
    .status(result.created ? 201 : 200)
    .json({
      success: true,
      data: {
        pricingPilot: result,
      },
    })
}

export async function updateFounderDecision(
  req,
  res,
) {
  const pricingPilot =
    await recordFounderDecision(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedBody.decision,
    )

  res.status(200).json({
    success: true,
    data: {
      pricingPilot,
    },
  })
}
