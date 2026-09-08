import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { validateBody } from '../../middleware/validateBody.js'
import {
  forgotPassword,
  login,
  logout,
  me,
  refresh,
  register,
  resetPassword,
} from './authController.js'
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from './validation.js'
import {
  forgotPasswordEmailRateLimiter,
  forgotPasswordRateLimiter,
  loginRateLimiter,
  refreshRateLimiter,
  registrationRateLimiter,
  resetPasswordRateLimiter,
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
  '/forgot-password',
  forgotPasswordRateLimiter,
  validateBody(forgotPasswordSchema),
  forgotPasswordEmailRateLimiter,
  forgotPassword,
)

authRoutes.post(
  '/reset-password',
  resetPasswordRateLimiter,
  validateBody(resetPasswordSchema),
  resetPassword,
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
