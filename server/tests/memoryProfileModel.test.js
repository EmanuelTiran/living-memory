import mongoose from 'mongoose'
import { describe, expect, it } from 'vitest'
import MemoryProfile from '../src/modules/memories/MemoryProfile.js'

const validProfileData = {
  ownerId: new mongoose.Types.ObjectId(),
  subjectName: 'Sarah Cohen',
  relationship: 'Grandmother',
  description:
    'A collection of family stories and memories.',
}

describe('MemoryProfile model', () => {
  it('accepts valid data and applies safe defaults', async () => {
    const profile = new MemoryProfile(
      validProfileData,
    )

    await expect(
      profile.validate(),
    ).resolves.toBeUndefined()

    expect(profile.visibility).toBe('private')
    expect(profile.status).toBe('active')
    expect(profile.subjectGender).toBe(
      'unspecified',
    )
    expect(profile.relationship).toBe(
      'Grandmother',
    )
  })

  it('stores gender and designated portrait and voice references', async () => {
    const portraitAssetId =
      new mongoose.Types.ObjectId()
    const voiceSampleRecordingId =
      new mongoose.Types.ObjectId()

    const profile = new MemoryProfile({
      ...validProfileData,
      subjectGender: 'female',
      portraitAssetId,
      voiceSampleRecordingId,
    })

    await expect(
      profile.validate(),
    ).resolves.toBeUndefined()

    expect(profile.toJSON()).toMatchObject({
      subjectGender: 'female',
      portraitAssetId:
        portraitAssetId.toString(),
      voiceSampleRecordingId:
        voiceSampleRecordingId.toString(),
    })
  })

  it('rejects invalid profile fields', async () => {
    const profile = new MemoryProfile({
      ownerId: validProfileData.ownerId,
      subjectName: 'A',
      relationship: 'R'.repeat(81),
      description: 'D'.repeat(1001),
      visibility: 'public',
      status: 'deleted',
    })

    const validationError = await profile
      .validate()
      .catch((error) => error)

    expect(validationError).toHaveProperty(
      'errors.subjectName',
    )

    expect(validationError).toHaveProperty(
      'errors.relationship',
    )

    expect(validationError).toHaveProperty(
      'errors.description',
    )

    expect(validationError).toHaveProperty(
      'errors.visibility',
    )

    expect(validationError).toHaveProperty(
      'errors.status',
    )
  })

  it('returns a public identifier in JSON', () => {
    const profile = new MemoryProfile(
      validProfileData,
    )

    const output = profile.toJSON()

    expect(output.id).toBe(
      profile._id.toString(),
    )

    expect(output).not.toHaveProperty('_id')
  })

  it('declares owner-scoped indexes', () => {
    const indexes =
      MemoryProfile.schema.indexes()

    const createdIndex = indexes.find(
      ([fields]) =>
        fields.ownerId === 1 &&
        fields.createdAt === -1,
    )

    const statusIndex = indexes.find(
      ([fields]) =>
        fields.ownerId === 1 &&
        fields.status === 1,
    )

    expect(createdIndex?.[1]).toMatchObject({
      name: 'memory_profiles_owner_created',
    })

    expect(statusIndex?.[1]).toMatchObject({
      name: 'memory_profiles_owner_status',
    })
  })
})