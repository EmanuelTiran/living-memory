import { describe, expect, it } from 'vitest'
import {
  loginSchema,
  registerSchema,
} from '../src/modules/auth/validation.js'

describe('Authentication validation', () => {
  it('normalizes valid registration input', () => {
    const result = registerSchema.parse({
      displayName: '  Emmanuel Tiran  ',
      email: '  USER@EXAMPLE.COM  ',
      password: 'a secure passphrase',
    })

    expect(result).toEqual({
      displayName: 'Emmanuel Tiran',
      email: 'user@example.com',
      password: 'a secure passphrase',
    })
  })

  it('allows Unicode and spaces in passwords', () => {
    const result = registerSchema.safeParse({
      displayName: 'עמנואל',
      email: 'user@example.com',
      password: 'סיסמה ארוכה ומאוד בטוחה',
    })

    expect(result.success).toBe(true)
  })

  it('accepts a valid invitation token', () => {
    const invitationToken = 'a'.repeat(43)
    const result = registerSchema.parse({
      displayName: 'Emmanuel',
      email: 'user@example.com',
      password: 'a secure passphrase',
      invitationToken,
    })

    expect(result.invitationToken).toBe(
      invitationToken,
    )
  })

  it('rejects a malformed invitation token', () => {
    const result = registerSchema.safeParse({
      displayName: 'Emmanuel',
      email: 'user@example.com',
      password: 'a secure passphrase',
      invitationToken: 'not-a-token',
    })

    expect(result.success).toBe(false)
    expect(
      result.error.issues.some(
        (issue) =>
          issue.path[0] ===
          'invitationToken',
      ),
    ).toBe(true)
  })

  it('rejects weak registration input', () => {
    const result = registerSchema.safeParse({
      displayName: 'E',
      email: 'invalid-email',
      password: 'too short',
    })

    expect(result.success).toBe(false)

    const paths = result.error.issues.map(
      (issue) => issue.path[0],
    )

    expect(paths).toContain('displayName')
    expect(paths).toContain('email')
    expect(paths).toContain('password')
  })

  it('rejects unknown registration fields', () => {
    const result = registerSchema.safeParse({
      displayName: 'Emmanuel',
      email: 'user@example.com',
      password: 'a secure passphrase',
      systemRole: 'admin',
    })

    expect(result.success).toBe(false)
    expect(result.error.issues[0].code).toBe(
      'unrecognized_keys',
    )
  })

  it('normalizes login input without applying registration length', () => {
    const result = loginSchema.parse({
      email: '  USER@EXAMPLE.COM  ',
      password: 'existing-password',
    })

    expect(result).toEqual({
      email: 'user@example.com',
      password: 'existing-password',
    })
  })
})