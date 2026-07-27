import mongoose from 'mongoose'
import {
  describe,
  expect,
  it,
} from 'vitest'
import MemoryMembership from '../src/modules/memories/MemoryMembership.js'

const validMembershipData = {
  memoryId: new mongoose.Types.ObjectId(),
  userId: new mongoose.Types.ObjectId(),
}

describe('MemoryMembership model', () => {
  it('accepts valid data and applies safe defaults', async () => {
    const membership =
      new MemoryMembership(
        validMembershipData,
      )

    await expect(
      membership.validate(),
    ).resolves.toBeUndefined()

    expect(membership.role).toBe('viewer')
    expect(membership.status).toBe('active')
  })

  it('rejects missing or invalid fields', async () => {
    const membership =
      new MemoryMembership({
        role: 'owner',
        status: 'deleted',
      })

    const validationError =
      await membership
        .validate()
        .catch((error) => error)

    expect(validationError).toHaveProperty(
      'errors.memoryId',
    )

    expect(validationError).toHaveProperty(
      'errors.userId',
    )

    expect(validationError).toHaveProperty(
      'errors.role',
    )

    expect(validationError).toHaveProperty(
      'errors.status',
    )
  })

  it('returns a public identifier in JSON', () => {
    const membership =
      new MemoryMembership(
        validMembershipData,
      )

    const output = membership.toJSON()

    expect(output.id).toBe(
      membership._id.toString(),
    )

    expect(output).not.toHaveProperty('_id')
  })

  it('declares membership lookup indexes', () => {
    const indexes =
      MemoryMembership.schema.indexes()

    const uniqueMembershipIndex =
      indexes.find(
        ([fields]) =>
          fields.memoryId === 1 &&
          fields.userId === 1,
      )

    const userStatusIndex =
      indexes.find(
        ([fields]) =>
          fields.userId === 1 &&
          fields.status === 1 &&
          fields.memoryId === 1,
      )

    expect(
      uniqueMembershipIndex?.[1],
    ).toMatchObject({
      unique: true,
      name:
        'memory_memberships_memory_user_unique',
    })

    expect(
      userStatusIndex?.[1],
    ).toMatchObject({
      name:
        'memory_memberships_user_status_memory',
    })
  })
})