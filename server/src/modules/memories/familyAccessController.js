import {
  acceptMemoryInvitation,
  createMemoryInvitation,
  getAccessibleMemoryProfile,
  getMemoryFamilyAccess,
  listSharedMemoryProfiles,
  previewMemoryInvitation,
  revokeMemoryInvitation,
  revokeMemoryMember,
  updateMemoryMemberRole,
} from './familyAccessService.js'
import {
  approveAccessibleMemoryStory,
  archiveAccessibleMemoryStory,
  createAccessibleMemoryStory,
  listAccessibleMemoryStories,
  updateAccessibleMemoryStory,
} from './familyStoryAccessService.js'
import {
  getMemoryPilot,
  startMemoryPilot,
  withdrawMemoryPilot,
} from './memoryPilotService.js'

export async function createInvitation(
  req,
  res,
) {
  const result =
    await createMemoryInvitation(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedBody,
    )

  res.status(201).json({
    success: true,
    data: result,
  })
}

export async function showFamilyAccess(
  req,
  res,
) {
  const familyAccess =
    await getMemoryFamilyAccess(
      req.auth.userId,
      req.validatedParams.memoryId,
    )

  res.status(200).json({
    success: true,
    data: {
      familyAccess,
    },
  })
}

export async function showSharedMemories(
  req,
  res,
) {
  const memoryProfiles =
    await listSharedMemoryProfiles(
      req.auth.userId,
    )

  res.status(200).json({
    success: true,
    data: {
      memoryProfiles,
    },
  })
}

export async function showAccessibleMemory(
  req,
  res,
) {
  const memoryProfile =
    await getAccessibleMemoryProfile(
      req.auth.userId,
      req.validatedParams.memoryId,
    )

  res.status(200).json({
    success: true,
    data: {
      memoryProfile,
    },
  })
}

export async function previewInvitation(
  req,
  res,
) {
  const invitation =
    await previewMemoryInvitation(
      req.validatedBody,
    )

  res.status(200).json({
    success: true,
    data: {
      invitation,
    },
  })
}

export async function acceptInvitation(
  req,
  res,
) {
  const result =
    await acceptMemoryInvitation(
      req.auth.userId,
      req.validatedBody,
    )

  res.status(200).json({
    success: true,
    data: result,
  })
}

export async function revokeInvitation(
  req,
  res,
) {
  const invitation =
    await revokeMemoryInvitation(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedParams.invitationId,
    )

  res.status(200).json({
    success: true,
    data: {
      invitation,
    },
  })
}

export async function changeMemberRole(
  req,
  res,
) {
  const member =
    await updateMemoryMemberRole(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedParams.membershipId,
      req.validatedBody,
    )

  res.status(200).json({
    success: true,
    data: {
      member,
    },
  })
}

export async function revokeMember(
  req,
  res,
) {
  const member = await revokeMemoryMember(
    req.auth.userId,
    req.validatedParams.memoryId,
    req.validatedParams.membershipId,
  )

  res.status(200).json({
    success: true,
    data: {
      member,
    },
  })
}

export async function createAccessibleStory(
  req,
  res,
) {
  const memoryStory =
    await createAccessibleMemoryStory(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedBody,
    )

  res.status(201).json({
    success: true,
    data: {
      memoryStory,
    },
  })
}

export async function listAccessibleStories(
  req,
  res,
) {
  const memoryStories =
    await listAccessibleMemoryStories(
      req.auth.userId,
      req.validatedParams.memoryId,
    )

  res.status(200).json({
    success: true,
    data: {
      memoryStories,
    },
  })
}

export async function approveAccessibleStory(
  req,
  res,
) {
  const memoryStory =
    await approveAccessibleMemoryStory(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedParams.storyId,
    )

  res.status(200).json({
    success: true,
    data: {
      memoryStory,
    },
  })
}

export async function updateAccessibleStory(
  req,
  res,
) {
  const memoryStory =
    await updateAccessibleMemoryStory(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedParams.storyId,
      req.validatedBody,
    )

  res.status(200).json({
    success: true,
    data: {
      memoryStory,
    },
  })
}

export async function archiveAccessibleStory(
  req,
  res,
) {
  await archiveAccessibleMemoryStory(
    req.auth.userId,
    req.validatedParams.memoryId,
    req.validatedParams.storyId,
  )

  res.status(204).send()
}

export async function showMemoryPilot(
  req,
  res,
) {
  const pilot = await getMemoryPilot(
    req.auth.userId,
    req.validatedParams.memoryId,
  )

  res.status(200).json({
    success: true,
    data: pilot,
  })
}

export async function createMemoryPilot(
  req,
  res,
) {
  const result = await startMemoryPilot(
    req.auth.userId,
    req.validatedParams.memoryId,
  )

  res
    .status(result.created ? 201 : 200)
    .json({
      success: true,
      data: result,
    })
}

export async function withdrawPilot(
  req,
  res,
) {
  const result = await withdrawMemoryPilot(
    req.auth.userId,
    req.validatedParams.memoryId,
  )

  res.status(200).json({
    success: true,
    data: result,
  })
}
