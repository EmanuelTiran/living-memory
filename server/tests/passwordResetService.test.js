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
  hashPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  revokeAllUserSessions: vi.fn(),
  loggerError: vi.fn(),
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

vi.mock('../src/modules/auth/password.js', () => ({
  hashPassword: mocks.hashPassword,
}))

vi.mock(
  '../src/modules/auth/passwordResetMailService.js',
  () => ({
    sendPasswordResetEmail:
      mocks.sendPasswordResetEmail,
  }),
)

vi.mock(
  '../src/modules/auth/sessionService.js',
  () => ({
    revokeAllUserSessions:
      mocks.revokeAllUserSessions,
  }),
)

vi.mock('../src/utils/logger.js', () => ({
  logger: {
    error: mocks.loggerError,
  },
}))

import {
  requestPasswordReset,
  resetPassword,
} from '../src/modules/auth/passwordResetService.js'

const userId = {
  toString: () => 'user-id',
}
const activeUser = {
  _id: userId,
  email: 'user@example.com',
  status: 'active',
}
const validToken = 'A'.repeat(43)
const validPassword =
  'a new secure passphrase'

afterEach(() => {
  vi.resetAllMocks()
})

describe('Password reset service', () => {
  describe('requestPasswordReset', () => {
    it('creates and emails a secure reset token for an active user', async () => {
      const before = Date.now()

      mocks.findOneAndUpdate.mockResolvedValue(
        activeUser,
      )
      mocks.updateOne.mockResolvedValue({
        modifiedCount: 1,
      })
      mocks.sendPasswordResetEmail.mockResolvedValue()

      await requestPasswordReset({
        email: '  USER@EXAMPLE.COM  ',
      })

      expect(
        mocks.findOneAndUpdate,
      ).toHaveBeenCalledWith(
        {
          email: 'user@example.com',
          status: 'active',
        },
        {
          $set: {
            passwordResetTokenHash:
              expect.stringMatching(
                /^[a-f0-9]{64}$/,
              ),
          },
          $unset: {
            passwordResetExpiresAt: 1,
          },
        },
        {
          returnDocument: 'after',
        },
      )

      const resetUrl = new URL(
        mocks.sendPasswordResetEmail.mock
          .calls[0][0].resetUrl,
      )
      const rawToken =
        resetUrl.searchParams.get('token')
      const storedHash =
        mocks.findOneAndUpdate.mock
          .calls[0][1].$set
          .passwordResetTokenHash

      expect(rawToken).toMatch(
        /^[A-Za-z0-9_-]{43}$/,
      )
      expect(storedHash).not.toBe(rawToken)
      expect(storedHash).toBe(
        createHash('sha256')
          .update(rawToken, 'utf8')
          .digest('hex'),
      )
      expect(resetUrl.origin).toBe(
        'https://zikaron-hai.co.il',
      )
      expect(resetUrl.pathname).toBe(
        '/reset-password',
      )

      expect(
        mocks.sendPasswordResetEmail,
      ).toHaveBeenCalledWith({
        to: 'user@example.com',
        resetUrl: resetUrl.toString(),
      })

      const activationUpdate =
        mocks.updateOne.mock.calls[0]
      const expiresAt =
        activationUpdate[1].$set
          .passwordResetExpiresAt

      expect(activationUpdate[0]).toEqual({
        _id: userId,
        passwordResetTokenHash: storedHash,
      })
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + 30 * 60 * 1000,
      )
      expect(expiresAt.getTime()).toBeLessThanOrEqual(
        Date.now() + 30 * 60 * 1000,
      )
    })

    it('returns the same empty result for an unknown email', async () => {
      mocks.findOneAndUpdate.mockResolvedValue(
        null,
      )

      await expect(
        requestPasswordReset({
          email: 'unknown@example.com',
        }),
      ).resolves.toBeUndefined()

      expect(
        mocks.sendPasswordResetEmail,
      ).not.toHaveBeenCalled()
    })

    it('does not send mail to a suspended account', async () => {
      mocks.findOneAndUpdate.mockResolvedValue(
        null,
      )

      await expect(
        requestPasswordReset({
          email: 'suspended@example.com',
        }),
      ).resolves.toBeUndefined()

      expect(
        mocks.findOneAndUpdate.mock.calls[0][0],
      ).toMatchObject({
        status: 'active',
      })
      expect(
        mocks.sendPasswordResetEmail,
      ).not.toHaveBeenCalled()
    })

    it('replaces the previous token when another reset is requested', async () => {
      mocks.findOneAndUpdate.mockResolvedValue(
        activeUser,
      )
      mocks.updateOne.mockResolvedValue({
        modifiedCount: 1,
      })
      mocks.sendPasswordResetEmail.mockResolvedValue()

      await requestPasswordReset({
        email: 'user@example.com',
      })
      await requestPasswordReset({
        email: 'user@example.com',
      })

      const firstHash =
        mocks.findOneAndUpdate.mock
          .calls[0][1].$set
          .passwordResetTokenHash
      const secondHash =
        mocks.findOneAndUpdate.mock
          .calls[1][1].$set
          .passwordResetTokenHash

      expect(firstHash).not.toBe(secondHash)
    })

    it('keeps provider failure non-enumerating and leaves no usable token', async () => {
      mocks.findOneAndUpdate.mockResolvedValue(
        activeUser,
      )
      mocks.sendPasswordResetEmail.mockRejectedValue(
        new Error('provider failure'),
      )
      mocks.updateOne.mockResolvedValue({
        modifiedCount: 1,
      })

      await expect(
        requestPasswordReset({
          email: 'user@example.com',
        }),
      ).resolves.toBeUndefined()

      const tokenHash =
        mocks.findOneAndUpdate.mock
          .calls[0][1].$set
          .passwordResetTokenHash

      expect(mocks.updateOne).toHaveBeenCalledWith(
        {
          _id: userId,
          passwordResetTokenHash: tokenHash,
        },
        {
          $unset: {
            passwordResetTokenHash: 1,
            passwordResetExpiresAt: 1,
          },
        },
      )
      expect(mocks.loggerError).toHaveBeenCalled()
    })

    it('rejects an invalid email before database access', async () => {
      await expect(
        requestPasswordReset({
          email: 'invalid-email',
        }),
      ).rejects.toMatchObject({
        name: 'ZodError',
      })

      expect(
        mocks.findOneAndUpdate,
      ).not.toHaveBeenCalled()
    })
  })

  describe('resetPassword', () => {
    function configureSuccessfulReset() {
      mocks.hashPassword.mockResolvedValue(
        'new-argon2id-password-hash',
      )
      mocks.findOneAndUpdate.mockResolvedValue(
        activeUser,
      )
      mocks.revokeAllUserSessions.mockResolvedValue()
    }

    it('atomically updates the password, clears reset metadata, and revokes sessions', async () => {
      configureSuccessfulReset()

      await resetPassword({
        token: validToken,
        password: validPassword,
      })

      expect(mocks.hashPassword).toHaveBeenCalledWith(
        validPassword,
      )

      const [filter, update, options] =
        mocks.findOneAndUpdate.mock.calls[0]

      expect(filter).toEqual({
        passwordResetTokenHash:
          createHash('sha256')
            .update(validToken, 'utf8')
            .digest('hex'),
        passwordResetExpiresAt: {
          $gt: expect.any(Date),
        },
        status: 'active',
      })
      expect(update).toEqual({
        $set: {
          passwordHash:
            'new-argon2id-password-hash',
        },
        $unset: {
          passwordResetTokenHash: 1,
          passwordResetExpiresAt: 1,
        },
      })
      expect(options).toEqual({
        returnDocument: 'after',
      })
      expect(
        mocks.revokeAllUserSessions,
      ).toHaveBeenCalledWith(
        'user-id',
        'security',
      )
    })

    it('enforces the registration password policy', async () => {
      await expect(
        resetPassword({
          token: validToken,
          password: 'too-short',
        }),
      ).rejects.toMatchObject({
        name: 'ZodError',
      })

      expect(
        mocks.hashPassword,
      ).not.toHaveBeenCalled()
      expect(
        mocks.findOneAndUpdate,
      ).not.toHaveBeenCalled()
    })

    it.each([
      'expired',
      'random',
      'already-used',
      'superseded',
    ])('rejects a %s token generically', async () => {
      mocks.hashPassword.mockResolvedValue(
        'new-argon2id-password-hash',
      )
      mocks.findOneAndUpdate.mockResolvedValue(
        null,
      )

      await expect(
        resetPassword({
          token: validToken,
          password: validPassword,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'PASSWORD_RESET_INVALID_OR_EXPIRED',
      })

      expect(
        mocks.revokeAllUserSessions,
      ).not.toHaveBeenCalled()
    })

    it('allows only one concurrent consumption of a token', async () => {
      mocks.hashPassword.mockResolvedValue(
        'new-argon2id-password-hash',
      )
      mocks.findOneAndUpdate
        .mockResolvedValueOnce(activeUser)
        .mockResolvedValueOnce(null)
      mocks.revokeAllUserSessions.mockResolvedValue()

      const results = await Promise.allSettled([
        resetPassword({
          token: validToken,
          password: validPassword,
        }),
        resetPassword({
          token: validToken,
          password: validPassword,
        }),
      ])

      expect(
        results.filter(
          (result) => result.status === 'fulfilled',
        ),
      ).toHaveLength(1)
      expect(
        results.filter(
          (result) => result.status === 'rejected',
        ),
      ).toHaveLength(1)
      expect(
        mocks.revokeAllUserSessions,
      ).toHaveBeenCalledOnce()
    })

    it('cannot bypass account suspension', async () => {
      mocks.hashPassword.mockResolvedValue(
        'new-argon2id-password-hash',
      )
      mocks.findOneAndUpdate.mockResolvedValue(
        null,
      )

      await expect(
        resetPassword({
          token: validToken,
          password: validPassword,
        }),
      ).rejects.toMatchObject({
        code: 'PASSWORD_RESET_INVALID_OR_EXPIRED',
      })

      expect(
        mocks.findOneAndUpdate.mock.calls[0][0],
      ).toMatchObject({
        status: 'active',
      })
    })
  })
})
