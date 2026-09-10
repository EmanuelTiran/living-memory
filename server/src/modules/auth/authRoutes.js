import express, { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { validateBody } from '../../middleware/validateBody.js'
import {
  forgotPassword,
  createGoogleRedirect,
  googleLogin,
  googleRedirectLogin,
  handleGoogleRedirectError,
  login,
  logout,
  me,
  prepareGoogleRedirectLogin,
  refresh,
  register,
  resolveGoogleRedirect,
  resetPassword,
} from './authController.js'
import {
  forgotPasswordSchema,
  googleAuthenticationSchema,
  googleRedirectAuthenticationSchema,
  googleRedirectContextSchema,
  googleRedirectRecoveryRequestSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from './validation.js'
import {
  forgotPasswordEmailRateLimiter,
  forgotPasswordRateLimiter,
  googleAuthenticationRateLimiter,
  googleRedirectStateCreationRateLimiter,
  googleRedirectStateResolutionRateLimiter,
  loginRateLimiter,
  refreshRateLimiter,
  registrationRateLimiter,
  resetPasswordRateLimiter,
} from './authRateLimiters.js'
import {
  requireGoogleAuthOrigin,
} from './googleAuthOrigin.js'
import {
  requireGoogleRedirectCsrf,
} from './googleRedirectCsrf.js'

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
  '/google',
  requireGoogleAuthOrigin,
  googleAuthenticationRateLimiter,
  validateBody(googleAuthenticationSchema),
  googleLogin,
)

authRoutes.post(
  '/google/redirect-state',
  requireGoogleAuthOrigin,
  googleRedirectStateCreationRateLimiter,
  validateBody(googleRedirectContextSchema),
  createGoogleRedirect,
)

authRoutes.post(
  '/google/redirect-state/resolve',
  requireGoogleAuthOrigin,
  googleRedirectStateResolutionRateLimiter,
  validateBody(
    googleRedirectRecoveryRequestSchema,
  ),
  resolveGoogleRedirect,
)

authRoutes.post(
  '/google/redirect',
  express.urlencoded({
    extended: false,
    limit: '25kb',
  }),
  requireGoogleRedirectCsrf,
  validateBody(
    googleRedirectAuthenticationSchema,
  ),
  prepareGoogleRedirectLogin,
  googleAuthenticationRateLimiter,
  googleRedirectLogin,
  handleGoogleRedirectError,
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
