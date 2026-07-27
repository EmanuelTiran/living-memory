import { describe, expect, it } from 'vitest'
import User from '../src/modules/auth/User.js'

describe('User model', () => {
  it('normalizes user data and applies safe defaults', async () => {
    const user = new User({
      displayName: '  Emmanuel  ',
      email: '  USER@EXAMPLE.COM  ',
      passwordHash: 'stored-password-hash',
    })

    await expect(
      user.validate(),
    ).resolves.toBeUndefined()

    expect(user.displayName).toBe('Emmanuel')
    expect(user.email).toBe('user@example.com')
    expect(user.systemRole).toBe('user')
    expect(user.status).toBe('active')
  })

  it('rejects an invalid email address', async () => {
    const user = new User({
      displayName: 'Emmanuel',
      email: 'invalid-email',
      passwordHash: 'stored-password-hash',
    })

    const validationError = await user
      .validate()
      .catch((error) => error)

    expect(validationError).toHaveProperty(
      'errors.email',
    )
  })

  it('rejects invalid roles and statuses', async () => {
    const user = new User({
      displayName: 'Emmanuel',
      email: 'user@example.com',
      passwordHash: 'stored-password-hash',
      systemRole: 'super-admin',
      status: 'unknown',
    })

    const validationError = await user
      .validate()
      .catch((error) => error)

    expect(validationError).toHaveProperty(
      'errors.systemRole',
    )

    expect(validationError).toHaveProperty(
      'errors.status',
    )
  })

  it('returns a safe public JSON representation', () => {
    const user = new User({
      displayName: 'Emmanuel',
      email: 'user@example.com',
      passwordHash: 'stored-password-hash',
    })

    const output = user.toJSON()

    expect(output.id).toBe(user._id.toString())

    expect(output).not.toHaveProperty('_id')

    expect(output).not.toHaveProperty(
      'passwordHash',
    )
  })
})