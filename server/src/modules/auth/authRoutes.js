import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { validateBody } from '../../middleware/validateBody.js'
import {
  login,
  logout,
  me,
  refresh,
  register,
} from './authController.js'
import {
  loginSchema,
  registerSchema,
} from './validation.js'

const authRoutes = Router()

authRoutes.post(
  '/register',
  validateBody(registerSchema),
  register,
)

authRoutes.post(
  '/login',
  validateBody(loginSchema),
  login,
)

authRoutes.post('/refresh', refresh)
authRoutes.post('/logout', logout)

authRoutes.get(
  '/me',
  requireAuth,
  me,
)

export default authRoutes