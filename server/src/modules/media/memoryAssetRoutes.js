import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { validateBody } from '../../middleware/validateBody.js'
import { validateParams } from '../../middleware/validateParams.js'
import { validateQuery } from '../../middleware/validateQuery.js'
import {
  accessAssetFile,
  archiveAsset,
  createAssetAccessLink,
  downloadAssetFile,
  listAssets,
  updateAssetMetadata,
  uploadAsset,
  viewAssetFile,
} from './memoryAssetController.js'
import { uploadMemoryAsset } from './memoryAssetUpload.js'
import {
  memoryAssetAccessLinkSchema,
  memoryAssetAccessQuerySchema,
  memoryAssetMemoryParamsSchema,
  memoryAssetParamsSchema,
  updateMemoryAssetMetadataSchema,
} from './memoryAssetValidation.js'

const memoryAssetRoutes = Router({
  mergeParams: true,
})

memoryAssetRoutes.get(
  '/:assetId/access',
  validateParams(memoryAssetParamsSchema),
  validateQuery(
    memoryAssetAccessQuerySchema,
  ),
  accessAssetFile,
)

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

memoryAssetRoutes.post(
  '/:assetId/access-link',
  validateParams(memoryAssetParamsSchema),
  validateBody(
    memoryAssetAccessLinkSchema,
  ),
  createAssetAccessLink,
)

memoryAssetRoutes.patch(
  '/:assetId',
  validateParams(memoryAssetParamsSchema),
  validateBody(
    updateMemoryAssetMetadataSchema,
  ),
  updateAssetMetadata,
)

memoryAssetRoutes.delete(
  '/:assetId',
  validateParams(memoryAssetParamsSchema),
  archiveAsset,
)

export default memoryAssetRoutes
