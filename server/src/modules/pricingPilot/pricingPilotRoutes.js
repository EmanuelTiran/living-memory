import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { validateBody } from '../../middleware/validateBody.js'
import { validateParams } from '../../middleware/validateParams.js'
import {
  offerFounderDeposit,
  showPricingPilot,
  updateFounderDecision,
} from './pricingPilotController.js'
import {
  founderDecisionSchema,
  pricingPilotMemoryParamsSchema,
} from './pricingPilotValidation.js'

const pricingPilotRoutes = Router({
  mergeParams: true,
})

pricingPilotRoutes.use(requireAuth)

pricingPilotRoutes.get(
  '/',
  validateParams(
    pricingPilotMemoryParamsSchema,
  ),
  showPricingPilot,
)

pricingPilotRoutes.post(
  '/offer',
  validateParams(
    pricingPilotMemoryParamsSchema,
  ),
  offerFounderDeposit,
)

pricingPilotRoutes.patch(
  '/decision',
  validateParams(
    pricingPilotMemoryParamsSchema,
  ),
  validateBody(founderDecisionSchema),
  updateFounderDecision,
)

export default pricingPilotRoutes
