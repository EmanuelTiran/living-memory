import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { validateBody } from '../../middleware/validateBody.js'
import { validateParams } from '../../middleware/validateParams.js'
import {
  getQuestionnaire,
  promoteCreativeMessage,
  saveQuestionnaireAnswer,
} from './biographyController.js'
import {
  biographyQuestionnaireAnswerParamsSchema,
  biographyQuestionnaireParamsSchema,
  creativeChatPromotionParamsSchema,
  promoteCreativeChatReplySchema,
  saveBiographyQuestionnaireResponseSchema,
} from './biographyValidation.js'

const biographyRoutes = Router({
  mergeParams: true,
})

biographyRoutes.use(requireAuth)

biographyRoutes.get(
  '/questionnaire',
  validateParams(
    biographyQuestionnaireParamsSchema,
  ),
  getQuestionnaire,
)

biographyRoutes.put(
  '/questionnaire/answers/:questionKey',
  validateParams(
    biographyQuestionnaireAnswerParamsSchema,
  ),
  validateBody(
    saveBiographyQuestionnaireResponseSchema,
  ),
  saveQuestionnaireAnswer,
)

biographyRoutes.post(
  '/creative-messages/:messageId',
  validateParams(
    creativeChatPromotionParamsSchema,
  ),
  validateBody(
    promoteCreativeChatReplySchema,
  ),
  promoteCreativeMessage,
)

export default biographyRoutes