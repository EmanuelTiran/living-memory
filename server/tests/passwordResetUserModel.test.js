import {
  describe,
  expect,
  it,
} from 'vitest'
import User from '../src/modules/auth/User.js'

describe('Password reset user fields', () => {
  it('keeps reset metadata out of normal queries and JSON', () => {
    expect(
      User.schema.path('passwordResetTokenHash')
        .options.select,
    ).toBe(false)
    expect(
      User.schema.path('passwordResetExpiresAt')
        .options.select,
    ).toBe(false)

    const user = new User({
      displayName: 'Test User',
      email: 'user@example.com',
      passwordHash: 'private-password-hash',
      passwordResetTokenHash: 'a'.repeat(64),
      passwordResetExpiresAt: new Date(),
    })
    const publicUser = user.toJSON()

    expect(publicUser).not.toHaveProperty(
      'passwordHash',
    )
    expect(publicUser).not.toHaveProperty(
      'passwordResetTokenHash',
    )
    expect(publicUser).not.toHaveProperty(
      'passwordResetExpiresAt',
    )
  })
})
