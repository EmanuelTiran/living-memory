import { AppError } from '../../errors/AppError.js'
import MemoryProfile from './MemoryProfile.js'
import MemoryStory from './MemoryStory.js'
import {
  createStoryRevisionSnapshot,
  MAX_SOURCE_REVISION_HISTORY,
} from './sourceRevisionHistory.js'
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

function createStoryConflictError() {
  return new AppError(
    'The story could not be changed because it was updated by another request.',
    {
      statusCode: 409,
      code: 'STORY_REVISION_CONFLICT',
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

  const {
    expectedRevision,
    ...storyChanges
  } = storyData

  await verifyMemoryOwnership(
    userId,
    validatedParams.memoryId,
  )

  const currentStory =
    await MemoryStory.findOne({
      _id: validatedParams.storyId,
      memoryId:
        validatedParams.memoryId,
      status: {
        $in: ['draft', 'approved'],
      },
    })

  if (!currentStory) {
    throw createStoryNotFoundError()
  }

  const currentRevision =
    Number.isInteger(
      currentStory.revision,
    )
      ? currentStory.revision
      : 1

  if (
    expectedRevision !== undefined &&
    expectedRevision !== currentRevision
  ) {
    throw createStoryConflictError()
  }

  const changedAt = new Date()
  const revisionSnapshot =
    createStoryRevisionSnapshot(
      currentStory,
      userId,
      changedAt,
    )

  const revisionQuery =
    currentRevision === 1
      ? {
          $or: [
            {
              revision: 1,
            },
            {
              revision: {
                $exists: false,
              },
            },
          ],
        }
      : {
          revision: currentRevision,
        }

  const memoryStory =
    await MemoryStory.findOneAndUpdate(
      {
        _id: validatedParams.storyId,
        memoryId:
          validatedParams.memoryId,
        status: {
          $in: ['draft', 'approved'],
        },
        ...revisionQuery,
      },
      {
        $set: {
          ...storyChanges,
          status: 'draft',
          approvedAt: null,
          approvedByUserId: null,
          lastEditedAt: changedAt,
          lastEditedByUserId: userId,
          revision:
            currentRevision + 1,
        },
        $push: {
          revisionHistory: {
            $each: [revisionSnapshot],
            $slice:
              -MAX_SOURCE_REVISION_HISTORY,
          },
        },
      },
      {
        returnDocument: 'after',
        runValidators: true,
      },
    )

  if (!memoryStory) {
    throw createStoryConflictError()
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
