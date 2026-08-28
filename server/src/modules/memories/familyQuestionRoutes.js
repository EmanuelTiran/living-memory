import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { validateBody } from '../../middleware/validateBody.js'
import { validateParams } from '../../middleware/validateParams.js'
import {
  createQuestion,
  listQuestions,
} from './familyQuestionController.js'
import {
  createFamilyQuestionSchema,
  familyQuestionMemoryParamsSchema,
} from './familyQuestionValidation.js'

const familyQuestionRoutes = Router({
  mergeParams: true,
})

familyQuestionRoutes.use(requireAuth)

familyQuestionRoutes.get(
  '/',
  validateParams(
    familyQuestionMemoryParamsSchema,
  ),
  listQuestions,
)

familyQuestionRoutes.post(
  '/',
  validateParams(
    familyQuestionMemoryParamsSchema,
  ),
  validateBody(
    createFamilyQuestionSchema,
  ),
  createQuestion,
)

export default familyQuestionRoutes
