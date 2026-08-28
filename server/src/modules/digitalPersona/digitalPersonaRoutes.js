import { Router } from 'express'
import { validateBody } from '../../middleware/validateBody.js'
import { validateParams } from '../../middleware/validateParams.js'
import {
  requirePilotAvatarFeature,
} from '../../middleware/requirePilotAvatarFeature.js'
import {
  activateApprovedDIDAvatar,
  activateApprovedChatVoiceInput,
  activateApprovedVoiceClone,
  approveSelfConsent,
  createMockProfiles,
  getSetup,
  revokeConsent,
} from './digitalPersonaController.js'
import {
  activateChatVoiceInputSchema,
  activateDIDAvatarSchema,
  activateVoiceCloneSchema,
  digitalPersonaParamsSchema,
  selfConsentSchema,
} from './digitalPersonaValidation.js'

const digitalPersonaRoutes = Router({
  mergeParams: true,
})

digitalPersonaRoutes.use(
  validateParams(
    digitalPersonaParamsSchema,
  ),
)

digitalPersonaRoutes.get('/', getSetup)

digitalPersonaRoutes.put(
  '/consent',
  validateBody(selfConsentSchema),
  approveSelfConsent,
)

digitalPersonaRoutes.delete(
  '/consent',
  revokeConsent,
)

digitalPersonaRoutes.post(
  '/mock-profiles',
  createMockProfiles,
)

digitalPersonaRoutes.put(
  '/voice-clone',
  validateBody(
    activateVoiceCloneSchema,
  ),
  activateApprovedVoiceClone,
)

digitalPersonaRoutes.put(
  '/chat-voice-input',
  validateBody(
    activateChatVoiceInputSchema,
  ),
  activateApprovedChatVoiceInput,
)

digitalPersonaRoutes.put(
  '/avatar',
  requirePilotAvatarFeature,
  validateBody(
    activateDIDAvatarSchema,
  ),
  activateApprovedDIDAvatar,
)

export default digitalPersonaRoutes
