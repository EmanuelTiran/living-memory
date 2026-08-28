import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { requireSystemAdmin } from '../../middleware/requireSystemAdmin.js'
import {
  showAdminOverview,
  showPilotOverview,
  showPricingPilotOverview,
  updatePricingParticipant,
} from './adminController.js'
import { validateBody } from '../../middleware/validateBody.js'
import { validateParams } from '../../middleware/validateParams.js'
import {
  founderPaymentActionSchema,
  pricingParticipantParamsSchema,
} from '../pricingPilot/pricingPilotValidation.js'

const adminRoutes = Router()

adminRoutes.use(
  requireAuth,
  requireSystemAdmin,
)

adminRoutes.get('/overview', showAdminOverview)
adminRoutes.get('/pilot', showPilotOverview)
adminRoutes.get(
  '/pricing-pilot',
  showPricingPilotOverview,
)
adminRoutes.patch(
  '/pricing-pilot/:participantCode',
  validateParams(
    pricingParticipantParamsSchema,
  ),
  validateBody(founderPaymentActionSchema),
  updatePricingParticipant,
)

export default adminRoutes
