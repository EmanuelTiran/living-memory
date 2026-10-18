import { AppError } from '../../errors/AppError.js'
import { MEMORY_PERMISSIONS, requireMemoryPermission } from '../memories/memoryAccessService.js'
import MemoryExternalVideo from './MemoryExternalVideo.js'
import { memoryAssetMemoryParamsSchema, memoryAssetMetadataSchema } from './memoryAssetValidation.js'
import { externalVideoInputSchema, externalVideoParamsSchema } from './memoryExternalVideoValidation.js'

export async function listMemoryExternalVideos(userId, memoryId) {
  const ids = memoryAssetMemoryParamsSchema.parse({ memoryId })
  await requireMemoryPermission(userId, ids.memoryId, MEMORY_PERMISSIONS.VIEW)
  const videos = await MemoryExternalVideo.find({ ...ids, lifecycleStatus: 'active' }).sort({ createdAt: -1, _id: -1 })
  return videos.map(video => video.toJSON())
}

export async function createMemoryExternalVideo(userId, memoryId, input) {
  const ids = memoryAssetMemoryParamsSchema.parse({ memoryId })
  const { url, ...metadata } = externalVideoInputSchema.parse(input)
  await requireMemoryPermission(userId, ids.memoryId, MEMORY_PERMISSIONS.CONTRIBUTE)
  const video = await MemoryExternalVideo.create({ ...ids, ...metadata, ...url, addedByUserId: userId })
  return video.toJSON()
}

async function changeVideo(userId, memoryId, externalVideoId, update) {
  const ids = externalVideoParamsSchema.parse({ memoryId, externalVideoId })
  await requireMemoryPermission(userId, ids.memoryId, MEMORY_PERMISSIONS.EDIT)
  const video = await MemoryExternalVideo.findOneAndUpdate({
    _id: ids.externalVideoId, memoryId: ids.memoryId, lifecycleStatus: 'active',
  }, { $set: update }, { returnDocument: 'after', runValidators: true })
  if (!video) throw new AppError('External video was not found.', { statusCode: 404, code: 'MEMORY_EXTERNAL_VIDEO_NOT_FOUND' })
  return video.toJSON()
}

export function updateMemoryExternalVideo(userId, memoryId, externalVideoId, input) {
  return changeVideo(userId, memoryId, externalVideoId, memoryAssetMetadataSchema.parse(input))
}

export function archiveMemoryExternalVideo(userId, memoryId, externalVideoId) {
  return changeVideo(userId, memoryId, externalVideoId, { lifecycleStatus: 'archived', archivedAt: new Date() })
}
