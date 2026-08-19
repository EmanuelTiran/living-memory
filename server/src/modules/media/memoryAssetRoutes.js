import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { validateParams } from '../../middleware/validateParams.js'
import {
  archiveAsset,
  downloadAssetFile,
  listAssets,
  uploadAsset,
  viewAssetFile,
} from './memoryAssetController.js'
import { uploadMemoryAsset } from './memoryAssetUpload.js'
import {
  memoryAssetMemoryParamsSchema,
  memoryAssetParamsSchema,
} from './memoryAssetValidation.js'

const memoryAssetRoutes = Router({
  mergeParams: true,
})

memoryAssetRoutes.use(requireAuth)

memoryAssetRoutes.get(
  '/',
  validateParams(
    memoryAssetMemoryParamsSchema,
  ),
  listAssets,
)

memoryAssetRoutes.post(
  '/',
  validateParams(
    memoryAssetMemoryParamsSchema,
  ),
  uploadMemoryAsset,
  uploadAsset,
)

memoryAssetRoutes.get(
  '/:assetId/file',
  validateParams(memoryAssetParamsSchema),
  viewAssetFile,
)

memoryAssetRoutes.get(
  '/:assetId/download',
  validateParams(memoryAssetParamsSchema),
  downloadAssetFile,
)

memoryAssetRoutes.delete(
  '/:assetId',
  validateParams(memoryAssetParamsSchema),
  archiveAsset,
)

export default memoryAssetRoutes
