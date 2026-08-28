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
import {
  loginRateLimiter,
  refreshRateLimiter,
  registrationRateLimiter,
} from './authRateLimiters.js'

const authRoutes = Router()

authRoutes.post(
  '/register',
  registrationRateLimiter,
  validateBody(registerSchema),
  register,
)

authRoutes.post(
  '/login',
  loginRateLimiter,
  validateBody(loginSchema),
  login,
)

authRoutes.post(
  '/refresh',
  refreshRateLimiter,
  refresh,
)
authRoutes.post('/logout', logout)

authRoutes.get(
  '/me',
  requireAuth,
  me,
)

export default authRoutes