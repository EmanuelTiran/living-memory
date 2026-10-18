import { Router } from 'express'
import { validateBody } from '../../middleware/validateBody.js'
import { validateParams } from '../../middleware/validateParams.js'
import { memoryAssetMemoryParamsSchema, memoryAssetMetadataSchema } from './memoryAssetValidation.js'
import { externalVideoInputSchema, externalVideoParamsSchema } from './memoryExternalVideoValidation.js'
import { archiveMemoryExternalVideo, createMemoryExternalVideo, listMemoryExternalVideos, updateMemoryExternalVideo } from './memoryExternalVideoService.js'

// Mounted after requireAuth in the existing asset router.
const routes = Router({ mergeParams: true })
routes.use((_req, res, next) => {
  res.set('Cache-Control', 'private, no-store')
  next()
})
routes.get('/', validateParams(memoryAssetMemoryParamsSchema), async (req, res) => {
  const externalVideos = await listMemoryExternalVideos(req.auth.userId, req.validatedParams.memoryId)
  res.json({ success: true, data: { externalVideos } })
})
routes.post('/', validateParams(memoryAssetMemoryParamsSchema), validateBody(externalVideoInputSchema), async (req, res) => {
  // Service validates the original input again, including URL normalization.
  const externalVideo = await createMemoryExternalVideo(req.auth.userId, req.validatedParams.memoryId, req.body)
  res.status(201).json({ success: true, data: { externalVideo } })
})
routes.patch('/:externalVideoId', validateParams(externalVideoParamsSchema), validateBody(memoryAssetMetadataSchema), async (req, res) => {
  const { memoryId, externalVideoId } = req.validatedParams
  const externalVideo = await updateMemoryExternalVideo(req.auth.userId, memoryId, externalVideoId, req.validatedBody)
  res.json({ success: true, data: { externalVideo } })
})
routes.delete('/:externalVideoId', validateParams(externalVideoParamsSchema), async (req, res) => {
  const { memoryId, externalVideoId } = req.validatedParams
  const externalVideo = await archiveMemoryExternalVideo(req.auth.userId, memoryId, externalVideoId)
  res.json({ success: true, data: { externalVideo } })
})
export default routes
