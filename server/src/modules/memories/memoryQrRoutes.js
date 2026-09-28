import { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../../errors/AppError.js'
import { createFixedWindowRateLimiter } from '../../middleware/createFixedWindowRateLimiter.js'
import { requireAuth } from '../../middleware/requireAuth.js'
import { validateBody } from '../../middleware/validateBody.js'
import { validateParams } from '../../middleware/validateParams.js'
import { validateQuery } from '../../middleware/validateQuery.js'
import { memoryProfileParamsSchema } from './validation.js'
import { publicPhotoParamsSchema, qrActionSchema, qrParamsSchema } from './memoryQrValidation.js'
import { changeMemoryQr, getMemoryQrManagement, getPublicPhoto, resolvePublicMemory } from './memoryQrService.js'

export function qrPrivacyHeaders(_req, res, next) {
  res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive', 'Referrer-Policy': 'no-referrer' })
  next()
}

function limiter(maxRequests, authenticated = false) {
  return createFixedWindowRateLimiter({
    windowMs: 60_000, maxRequests,
    resolveKey: (req) => authenticated ? req.auth.userId : (req.ip || 'unknown'),
    createRateLimitError: () => new AppError('Too many requests. Try again shortly.', {
      statusCode: 429, code: 'QR_RATE_LIMITED',
    }),
  })
}

export const memoryQrRoutes = Router({ mergeParams: true })
memoryQrRoutes.use(qrPrivacyHeaders, requireAuth, validateParams(memoryProfileParamsSchema), validateQuery(z.strictObject({})), limiter(30, true))
memoryQrRoutes.get('/', async (req, res) => {
  res.json({ success: true, data: await getMemoryQrManagement(req.auth.userId, req.validatedParams.memoryId) })
})
memoryQrRoutes.post('/', validateBody(qrActionSchema), async (req, res) => {
  res.json({ success: true, data: await changeMemoryQr(req.auth.userId, req.validatedParams.memoryId, req.validatedBody) })
})

export const publicMemoryRoutes = Router()
publicMemoryRoutes.use(qrPrivacyHeaders, limiter(120), validateQuery(z.strictObject({})))
publicMemoryRoutes.get('/:token', validateParams(qrParamsSchema), async (req, res) => {
  res.json({ success: true, data: await resolvePublicMemory(req.validatedParams.token) })
})
publicMemoryRoutes.get('/:token/photos/:photo', limiter(60), validateParams(publicPhotoParamsSchema), async (req, res) => {
  const buffer = await getPublicPhoto(req.validatedParams.token, req.validatedParams.photo)
  res.set('Content-Disposition', 'inline; filename="memory-photo.webp"').type('image/webp').send(buffer)
})
