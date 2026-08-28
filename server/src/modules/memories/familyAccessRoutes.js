import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { validateBody } from '../../middleware/validateBody.js'
import { validateParams } from '../../middleware/validateParams.js'
import {
  acceptInvitation,
  approveAccessibleStory,
  archiveAccessibleStory,
  changeMemberRole,
  createAccessibleStory,
  createInvitation,
  previewInvitation,
  revokeInvitation,
  revokeMember,
  showAccessibleMemory,
  showFamilyAccess,
  showSharedMemories,
  listAccessibleStories,
  createMemoryPilot,
  updateAccessibleStory,
  showMemoryPilot,
  withdrawPilot,
} from './familyAccessController.js'
import {
  acceptMemoryInvitationSchema,
  createMemoryInvitationSchema,
  memoryInvitationParamsSchema,
  memoryMembershipParamsSchema,
  previewMemoryInvitationSchema,
  updateMemoryMembershipSchema,
} from './familyAccessValidation.js'
import {
  createMemoryStorySchema,
  memoryProfileParamsSchema,
  memoryStoryParamsSchema,
  updateMemoryStorySchema,
} from './validation.js'

const familyAccessRoutes = Router()

familyAccessRoutes.post(
  '/invitations/preview',
  validateBody(previewMemoryInvitationSchema),
  previewInvitation,
)

familyAccessRoutes.post(
  '/invitations/accept',
  requireAuth,
  validateBody(acceptMemoryInvitationSchema),
  acceptInvitation,
)

familyAccessRoutes.use(requireAuth)

familyAccessRoutes.get(
  '/memories',
  showSharedMemories,
)

familyAccessRoutes.get(
  '/memories/:memoryId',
  validateParams(memoryProfileParamsSchema),
  showAccessibleMemory,
)

familyAccessRoutes.get(
  '/memories/:memoryId/stories',
  validateParams(memoryProfileParamsSchema),
  listAccessibleStories,
)

familyAccessRoutes.post(
  '/memories/:memoryId/stories',
  validateParams(memoryProfileParamsSchema),
  validateBody(createMemoryStorySchema),
  createAccessibleStory,
)

familyAccessRoutes.patch(
  '/memories/:memoryId/stories/:storyId/approve',
  validateParams(memoryStoryParamsSchema),
  approveAccessibleStory,
)

familyAccessRoutes.patch(
  '/memories/:memoryId/stories/:storyId',
  validateParams(memoryStoryParamsSchema),
  validateBody(updateMemoryStorySchema),
  updateAccessibleStory,
)

familyAccessRoutes.delete(
  '/memories/:memoryId/stories/:storyId',
  validateParams(memoryStoryParamsSchema),
  archiveAccessibleStory,
)

familyAccessRoutes.get(
  '/memories/:memoryId/access',
  validateParams(memoryProfileParamsSchema),
  showFamilyAccess,
)

familyAccessRoutes.get(
  '/memories/:memoryId/pilot',
  validateParams(memoryProfileParamsSchema),
  showMemoryPilot,
)

familyAccessRoutes.post(
  '/memories/:memoryId/pilot',
  validateParams(memoryProfileParamsSchema),
  createMemoryPilot,
)

familyAccessRoutes.patch(
  '/memories/:memoryId/pilot/withdraw',
  validateParams(memoryProfileParamsSchema),
  withdrawPilot,
)

familyAccessRoutes.post(
  '/memories/:memoryId/invitations',
  validateParams(memoryProfileParamsSchema),
  validateBody(createMemoryInvitationSchema),
  createInvitation,
)

familyAccessRoutes.delete(
  '/memories/:memoryId/invitations/:invitationId',
  validateParams(memoryInvitationParamsSchema),
  revokeInvitation,
)

familyAccessRoutes.patch(
  '/memories/:memoryId/members/:membershipId',
  validateParams(memoryMembershipParamsSchema),
  validateBody(updateMemoryMembershipSchema),
  changeMemberRole,
)

familyAccessRoutes.delete(
  '/memories/:memoryId/members/:membershipId',
  validateParams(memoryMembershipParamsSchema),
  revokeMember,
)

export default familyAccessRoutes
