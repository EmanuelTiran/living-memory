import { createHash } from 'node:crypto'
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(),
  revokeAllUserSessions: vi.fn(),
}))

vi.mock('../src/config/env.js', () => ({
  env: {
    publicAppUrl: 'https://zikaron-hai.co.il',
  },
}))

vi.mock('../src/modules/auth/User.js', () => ({
  default: {
    findOneAndUpdate:
      mocks.findOneAndUpdate,
    updateOne: mocks.updateOne,
  },
}))

vi.mock(
  '../src/modules/auth/passwordResetMailService.js',
  () => ({
    sendPasswordResetEmail: vi.fn(),
  }),
)

vi.mock(
  '../src/modules/auth/sessionService.js',
  () => ({
    revokeAllUserSessions:
      mocks.revokeAllUserSessions,
  }),
)

import {
  hashPassword,
  verifyPassword,
} from '../src/modules/auth/password.js'
import {
  resetPassword,
} from '../src/modules/auth/passwordResetService.js'

afterEach(() => {
  vi.resetAllMocks()
})

describe('Password reset password integration', () => {
  it('replaces the Argon2id hash so only the new password authenticates', async () => {
    const token = 'B'.repeat(43)
    const oldPassword =
      'the original secure password'
    const newPassword =
      'the replacement secure password'
    const record = {
      _id: {
        toString: () => 'user-id',
      },
      status: 'active',
      googleSubject: 'google-subject-123',
      passwordHash: await hashPassword(oldPassword),
      passwordResetTokenHash: createHash('sha256')
        .update(token, 'utf8')
        .digest('hex'),
      passwordResetExpiresAt: new Date(
        Date.now() + 30 * 60 * 1000,
      ),
    }

    mocks.findOneAndUpdate.mockImplementation(
      async (filter, update) => {
        if (
          filter.passwordResetTokenHash !==
            record.passwordResetTokenHash ||
          filter.status !== record.status ||
          record.passwordResetExpiresAt <=
            filter.passwordResetExpiresAt.$gt
        ) {
          return null
        }

        record.passwordHash =
          update.$set.passwordHash
        delete record.passwordResetTokenHash
        delete record.passwordResetExpiresAt

        return record
      },
    )
    mocks.revokeAllUserSessions.mockResolvedValue()

    await resetPassword({
      token,
      password: newPassword,
    })

    expect(record.passwordHash).toMatch(
      /^\$argon2id\$/,
    )
    await expect(
      verifyPassword(
        record.passwordHash,
        oldPassword,
      ),
    ).resolves.toBe(false)
    await expect(
      verifyPassword(
        record.passwordHash,
        newPassword,
      ),
    ).resolves.toBe(true)
    expect(record).not.toHaveProperty(
      'passwordResetTokenHash',
    )
    expect(record).not.toHaveProperty(
      'passwordResetExpiresAt',
    )
    expect(record.googleSubject).toBe(
      'google-subject-123',
    )
    expect(
      mocks.revokeAllUserSessions,
    ).toHaveBeenCalledWith(
      'user-id',
      'security',
    )
  })

  it('sets a first password for a Google-only user without unlinking Google', async () => {
    const token = 'C'.repeat(43)
    const newPassword =
      'the first secure password'
    const record = {
      _id: {
        toString: () => 'google-only-user-id',
      },
      status: 'active',
      googleSubject: 'google-subject-456',
      passwordResetTokenHash: createHash('sha256')
        .update(token, 'utf8')
        .digest('hex'),
      passwordResetExpiresAt: new Date(
        Date.now() + 30 * 60 * 1000,
      ),
    }

    mocks.findOneAndUpdate.mockImplementation(
      async (filter, update) => {
        if (
          filter.passwordResetTokenHash !==
            record.passwordResetTokenHash ||
          filter.status !== record.status ||
          record.passwordResetExpiresAt <=
            filter.passwordResetExpiresAt.$gt
        ) {
          return null
        }

        record.passwordHash =
          update.$set.passwordHash
        delete record.passwordResetTokenHash
        delete record.passwordResetExpiresAt

        return record
      },
    )
    mocks.revokeAllUserSessions.mockResolvedValue()

    await resetPassword({
      token,
      password: newPassword,
    })

    await expect(
      verifyPassword(
        record.passwordHash,
        newPassword,
      ),
    ).resolves.toBe(true)
    expect(record.googleSubject).toBe(
      'google-subject-456',
    )
    expect(
      mocks.revokeAllUserSessions,
    ).toHaveBeenCalledWith(
      'google-only-user-id',
      'security',
    )
  })
})
