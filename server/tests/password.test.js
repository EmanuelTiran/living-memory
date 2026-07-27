import * as argon2 from 'argon2'
import { describe, expect, it } from 'vitest'
import {
  hashPassword,
  passwordNeedsRehash,
  verifyPassword,
} from '../src/modules/auth/password.js'

describe('Password service', () => {
  it('hashes and verifies a password', async () => {
    const password = 'correct horse battery staple'
    const passwordHash = await hashPassword(password)

    expect(passwordHash).toMatch(/^\$argon2id\$/)
    expect(passwordHash).not.toContain(password)

    await expect(
      verifyPassword(passwordHash, password),
    ).resolves.toBe(true)

    await expect(
      verifyPassword(passwordHash, 'wrong password'),
    ).resolves.toBe(false)

    expect(passwordNeedsRehash(passwordHash)).toBe(false)
  })

  it('generates different hashes for the same password', async () => {
    const password = 'same password for both hashes'

    const firstHash = await hashPassword(password)
    const secondHash = await hashPassword(password)

    expect(firstHash).not.toBe(secondHash)

    await expect(
      verifyPassword(firstHash, password),
    ).resolves.toBe(true)

    await expect(
      verifyPassword(secondHash, password),
    ).resolves.toBe(true)
  })

  it('detects a hash with weaker parameters', async () => {
    const weakHash = await argon2.hash('test password', {
      type: argon2.argon2id,
      memoryCost: 8192,
      timeCost: 1,
      parallelism: 1,
    })

    expect(passwordNeedsRehash(weakHash)).toBe(true)
  })

  it('rejects invalid password input', async () => {
    await expect(hashPassword('')).rejects.toThrow(
      'Password must contain between 1 and 1024 UTF-8 bytes.',
    )

    await expect(
      hashPassword('a'.repeat(1025)),
    ).rejects.toThrow(
      'Password must contain between 1 and 1024 UTF-8 bytes.',
    )
  })
})