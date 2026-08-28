import { AppError } from '../../errors/AppError.js'
import MemoryStory from './MemoryStory.js'
import {
  MEMORY_PERMISSIONS,
  requireMemoryPermission,
} from './memoryAccessService.js'
import {
  createMemoryStorySchema,
  memoryProfileParamsSchema,
  memoryStoryParamsSchema,
  updateMemoryStorySchema,
} from './validation.js'

function validateUserId(userId) {
  if (
    typeof userId !== 'string' ||
    userId.length === 0
  ) {
    throw new TypeError(
      'User ID must be a non-empty string.',
    )
  }
}

function createStoryNotFoundError() {
  return new AppError(
    'Memory story was not found.',
    {
      statusCode: 404,
      code: 'STORY_NOT_FOUND',
    },
  )
}

export async function createAccessibleMemoryStory(
  userId,
  memoryId,
  input,
) {
  validateUserId(userId)

  const validatedMemoryId =
    memoryProfileParamsSchema.parse({
      memoryId,
    }).memoryId
  const storyData =
    createMemoryStorySchema.parse(input)

  await requireMemoryPermission(
    userId,
    validatedMemoryId,
    MEMORY_PERMISSIONS.CONTRIBUTE,
  )

  const memoryStory = await MemoryStory.create({
    memoryId: validatedMemoryId,
    authorId: userId,
    title: storyData.title,
    content: storyData.content,
    occurredOn: storyData.occurredOn ?? '',
  })

  return memoryStory.toJSON()
}

export async function listAccessibleMemoryStories(
  userId,
  memoryId,
) {
  validateUserId(userId)

  const validatedMemoryId =
    memoryProfileParamsSchema.parse({
      memoryId,
    }).memoryId

  await requireMemoryPermission(
    userId,
    validatedMemoryId,
    MEMORY_PERMISSIONS.VIEW,
  )

  const memoryStories =
    await MemoryStory.find({
      memoryId: validatedMemoryId,
      status: {
        $in: ['draft', 'approved'],
      },
    }).sort({
      createdAt: -1,
    })

  return memoryStories.map((story) =>
    story.toJSON(),
  )
}

async function requireStoryEditPermission(
  userId,
  memoryId,
  storyId,
) {
  validateUserId(userId)

  const validatedParams =
    memoryStoryParamsSchema.parse({
      memoryId,
      storyId,
    })

  await requireMemoryPermission(
    userId,
    validatedParams.memoryId,
    MEMORY_PERMISSIONS.EDIT,
  )

  return validatedParams
}

export async function approveAccessibleMemoryStory(
  userId,
  memoryId,
  storyId,
) {
  const validatedParams =
    await requireStoryEditPermission(
      userId,
      memoryId,
      storyId,
    )

  const memoryStory =
    await MemoryStory.findOneAndUpdate(
      {
        _id: validatedParams.storyId,
        memoryId:
          validatedParams.memoryId,
        status: {
          $in: ['draft', 'approved'],
        },
      },
      {
        $set: {
          status: 'approved',
        },
      },
      {
        returnDocument: 'after',
      },
    )

  if (!memoryStory) {
    throw createStoryNotFoundError()
  }

  return memoryStory.toJSON()
}

export async function updateAccessibleMemoryStory(
  userId,
  memoryId,
  storyId,
  input,
) {
  const storyData =
    updateMemoryStorySchema.parse(input)
  const validatedParams =
    await requireStoryEditPermission(
      userId,
      memoryId,
      storyId,
    )

  const memoryStory =
    await MemoryStory.findOneAndUpdate(
      {
        _id: validatedParams.storyId,
        memoryId:
          validatedParams.memoryId,
        status: {
          $in: ['draft', 'approved'],
        },
      },
      {
        $set: {
          ...storyData,
          status: 'draft',
        },
      },
      {
        returnDocument: 'after',
      },
    )

  if (!memoryStory) {
    throw createStoryNotFoundError()
  }

  return memoryStory.toJSON()
}

export async function archiveAccessibleMemoryStory(
  userId,
  memoryId,
  storyId,
) {
  const validatedParams =
    await requireStoryEditPermission(
      userId,
      memoryId,
      storyId,
    )

  const memoryStory =
    await MemoryStory.findOneAndUpdate(
      {
        _id: validatedParams.storyId,
        memoryId:
          validatedParams.memoryId,
        status: {
          $in: ['draft', 'approved'],
        },
      },
      {
        $set: {
          status: 'archived',
        },
      },
      {
        returnDocument: 'after',
      },
    )

  if (!memoryStory) {
    throw createStoryNotFoundError()
  }

  return memoryStory.toJSON()
}
