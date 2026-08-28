import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { validateBody } from '../../middleware/validateBody.js'
import { validateParams } from '../../middleware/validateParams.js'
import { validateQuery } from '../../middleware/validateQuery.js'
import digitalPersonaRoutes from '../digitalPersona/digitalPersonaRoutes.js'
import {
  archiveMemory,
  createMemory,
  getMemory,
  listMemories,
  updateMemory,
} from './memoryController.js'
import {
  approveStory,
  archiveStory,
  createStory,
  listStories,
  updateStory,
} from './memoryStoryController.js'
import {
  getMemoryTimeline,
} from './memoryTimelineController.js'
import {
  searchArchive,
} from './archiveSearchController.js'
import {
  archiveSearchQuerySchema,
} from './archiveSearchValidation.js'
import {
  createMemoryProfileSchema,
  createMemoryStorySchema,
  memoryProfileParamsSchema,
  memoryStoryParamsSchema,
  updateMemoryProfileSchema,
  updateMemoryStorySchema,
} from './validation.js'

const memoryRoutes = Router()

memoryRoutes.use(requireAuth)

memoryRoutes.get('/', listMemories)

memoryRoutes.post(
  '/',
  validateBody(createMemoryProfileSchema),
  createMemory,
)

memoryRoutes.use(
  '/:memoryId/digital-persona',
  digitalPersonaRoutes,
)

memoryRoutes.get(
  '/:memoryId/stories',
  validateParams(memoryProfileParamsSchema),
  listStories,
)

memoryRoutes.get(
  '/:memoryId/timeline',
  validateParams(memoryProfileParamsSchema),
  getMemoryTimeline,
)

memoryRoutes.get(
  '/:memoryId/archive-search',
  validateParams(memoryProfileParamsSchema),
  validateQuery(archiveSearchQuerySchema),
  searchArchive,
)

memoryRoutes.post(
  '/:memoryId/stories',
  validateParams(memoryProfileParamsSchema),
  validateBody(createMemoryStorySchema),
  createStory,
)

memoryRoutes.patch(
  '/:memoryId/stories/:storyId/approve',
  validateParams(memoryStoryParamsSchema),
  approveStory,
)

memoryRoutes.patch(
  '/:memoryId/stories/:storyId',
  validateParams(memoryStoryParamsSchema),
  validateBody(updateMemoryStorySchema),
  updateStory,
)

memoryRoutes.delete(
  '/:memoryId/stories/:storyId',
  validateParams(memoryStoryParamsSchema),
  archiveStory,
)

memoryRoutes.patch(
  '/:memoryId',
  validateParams(memoryProfileParamsSchema),
  validateBody(updateMemoryProfileSchema),
  updateMemory,
)

memoryRoutes.delete(
  '/:memoryId',
  validateParams(memoryProfileParamsSchema),
  archiveMemory,
)

memoryRoutes.get(
  '/:memoryId',
  validateParams(memoryProfileParamsSchema),
  getMemory,
)

export default memoryRoutes
