import MemoryProfile from '../memories/MemoryProfile.js'
import { createApprovedSource } from './approvedSource.js'

function createProfileVersion(
  memoryProfile,
) {
  if (
    memoryProfile.updatedAt instanceof
    Date
  ) {
    return memoryProfile.updatedAt
      .toISOString()
  }

  const updatedAt = String(
    memoryProfile.updatedAt ?? '',
  ).trim()

  return updatedAt ||
    `profile:${memoryProfile._id}`
}

function createProfileNameSource(
  memoryProfile,
) {
  const genderStatement = {
    female:
      'יש לפנות אליה בלשון נקבה.',
    male:
      'יש לפנות אליו בלשון זכר.',
  }[memoryProfile.subjectGender] ?? ''

  return createApprovedSource({
    sourceType: 'memory_profile',
    sourceId:
      memoryProfile._id.toString(),
    title:
      'שם האדם בפרופיל הארכיון',
    content:
      [
        `שם האדם המתועד בארכיון הוא ${memoryProfile.subjectName}.`,
        genderStatement,
      ]
        .filter(Boolean)
        .join(' '),
    approvedAt: null,
    sourceVersion:
      createProfileVersion(
        memoryProfile,
      ),
    sourceRoute:
      `/app/memories/${memoryProfile._id}#memory-profile-title`,
  })
}

export async function listApprovedProfileSources(
  memoryId,
) {
  const memoryProfile =
    await MemoryProfile.findOne({
      _id: memoryId,
      status: 'active',
    })
      .select({
        _id: 1,
        subjectName: 1,
        subjectGender: 1,
        updatedAt: 1,
      })
      .lean()

  return memoryProfile
    ? [
        createProfileNameSource(
          memoryProfile,
        ),
      ]
    : []
}

export const approvedProfileSourceProvider =
  Object.freeze({
    sourceType: 'memory_profile',
    listApprovedSources:
      listApprovedProfileSources,
  })
