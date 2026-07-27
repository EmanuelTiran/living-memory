import { AppError } from '../../errors/AppError.js'
import MemoryProfile from './MemoryProfile.js'
import {
  createMemoryProfileSchema,
  memoryProfileParamsSchema,
  updateMemoryProfileSchema,
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

function validateMemoryId(memoryId) {
  return memoryProfileParamsSchema.parse({
    memoryId,
  }).memoryId
}

export async function createMemoryProfile(
  userId,
  input,
) {
  validateUserId(userId)

  const profileData =
    createMemoryProfileSchema.parse(input)

  const memoryProfile =
    await MemoryProfile.create({
      ownerId: userId,
      subjectName: profileData.subjectName,
      relationship:
        profileData.relationship ?? '',
      description:
        profileData.description ?? '',
    })

  return memoryProfile.toJSON()
}

export async function listMemoryProfiles(userId) {
  validateUserId(userId)

  const memoryProfiles =
    await MemoryProfile.find({
      ownerId: userId,
      status: 'active',
    }).sort({
      createdAt: -1,
    })

  return memoryProfiles.map((profile) =>
    profile.toJSON(),
  )
}

export async function getMemoryProfile(
  userId,
  memoryId,
) {
  validateUserId(userId)

  const validatedMemoryId =
    validateMemoryId(memoryId)

  const memoryProfile =
    await MemoryProfile.findOne({
      _id: validatedMemoryId,
      ownerId: userId,
      status: 'active',
    })

  if (!memoryProfile) {
    throw createMemoryNotFoundError()
  }

  return memoryProfile.toJSON()
}

export async function updateMemoryProfile(
  userId,
  memoryId,
  input,
) {
  validateUserId(userId)

  const validatedMemoryId =
    validateMemoryId(memoryId)

  const profileData =
    updateMemoryProfileSchema.parse(input)

  const memoryProfile =
    await MemoryProfile.findOneAndUpdate(
      {
        _id: validatedMemoryId,
        ownerId: userId,
        status: 'active',
      },
      {
        $set: profileData,
      },
      {
        returnDocument: 'after',
      },
    )

  if (!memoryProfile) {
    throw createMemoryNotFoundError()
  }

  return memoryProfile.toJSON()
}

export async function archiveMemoryProfile(
  userId,
  memoryId,
) {
  validateUserId(userId)

  const validatedMemoryId =
    validateMemoryId(memoryId)

  const memoryProfile =
    await MemoryProfile.findOneAndUpdate(
      {
        _id: validatedMemoryId,
        ownerId: userId,
        status: 'active',
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

  if (!memoryProfile) {
    throw createMemoryNotFoundError()
  }

  return memoryProfile.toJSON()
}