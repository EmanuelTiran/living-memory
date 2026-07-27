import { AppError } from '../../errors/AppError.js'
import MemoryProfile from './MemoryProfile.js'
import MemoryStory from './MemoryStory.js'
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

function createMemoryNotFoundError() {
  return new AppError(
    'Memory profile was not found.',
    {
      statusCode: 404,
      code: 'MEMORY_NOT_FOUND',
    },
  )
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

function validateMemoryId(memoryId) {
  return memoryProfileParamsSchema.parse({
    memoryId,
  }).memoryId
}

async function verifyMemoryOwnership(
  userId,
  memoryId,
) {
  const memoryProfileExists =
    await MemoryProfile.exists({
      _id: memoryId,
      ownerId: userId,
      status: 'active',
    })

  if (!memoryProfileExists) {
    throw createMemoryNotFoundError()
  }
}

export async function createMemoryStory(
  userId,
  memoryId,
  input,
) {
  validateUserId(userId)

  const validatedMemoryId =
    validateMemoryId(memoryId)

  const storyData =
    createMemoryStorySchema.parse(input)

  await verifyMemoryOwnership(
    userId,
    validatedMemoryId,
  )

  const memoryStory =
    await MemoryStory.create({
      memoryId: validatedMemoryId,
      authorId: userId,
      title: storyData.title,
      content: storyData.content,
      occurredOn:
        storyData.occurredOn ?? '',
    })

  return memoryStory.toJSON()
}

export async function listMemoryStories(
  userId,
  memoryId,
) {
  validateUserId(userId)

  const validatedMemoryId =
    validateMemoryId(memoryId)

  await verifyMemoryOwnership(
    userId,
    validatedMemoryId,
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

export async function approveMemoryStory(
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

  await verifyMemoryOwnership(
    userId,
    validatedParams.memoryId,
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

export async function updateMemoryStory(
  userId,
  memoryId,
  storyId,
  input,
) {
  validateUserId(userId)

  const validatedParams =
    memoryStoryParamsSchema.parse({
      memoryId,
      storyId,
    })

  const storyData =
    updateMemoryStorySchema.parse(input)

  await verifyMemoryOwnership(
    userId,
    validatedParams.memoryId,
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

export async function archiveMemoryStory(
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

  await verifyMemoryOwnership(
    userId,
    validatedParams.memoryId,
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