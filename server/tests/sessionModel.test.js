import mongoose from 'mongoose'
import { describe, expect, it } from 'vitest'
import Session from '../src/modules/auth/Session.js'

const validSessionData = {
  userId: new mongoose.Types.ObjectId(),
  refreshTokenHash: 'a'.repeat(64),
  familyId: '1d4d17ac-4014-4cd6-a33e-e6cb3939d918',
  expiresAt: new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ),
}

describe('Session model', () => {
  it('accepts a valid session and applies defaults', async () => {
    const session = new Session(validSessionData)

    await expect(
      session.validate(),
    ).resolves.toBeUndefined()

    expect(session.userId).toEqual(
      validSessionData.userId,
    )

    expect(session.lastUsedAt).toBeInstanceOf(Date)
    expect(session.revokedAt).toBeNull()
    expect(session.revocationReason).toBeNull()
    expect(session.replacedBySessionId).toBeNull()
  })

  it('rejects invalid session identifiers', async () => {
    const session = new Session({
      ...validSessionData,
      refreshTokenHash: 'invalid-hash',
      familyId: 'invalid-family-id',
      expiresAt: 'invalid-date',
    })

    const validationError = await session
      .validate()
      .catch((error) => error)

    expect(validationError).toHaveProperty(
      'errors.refreshTokenHash',
    )

    expect(validationError).toHaveProperty(
      'errors.familyId',
    )

    expect(validationError).toHaveProperty(
      'errors.expiresAt',
    )
  })

  it('does not expose the refresh-token hash in JSON', () => {
    const session = new Session(validSessionData)

    const output = session.toJSON()

    expect(output).not.toHaveProperty(
      'refreshTokenHash',
    )
  })

  it('declares the required security indexes', () => {
    const indexes = Session.schema.indexes()

    const refreshTokenIndex = indexes.find(
      ([fields]) => fields.refreshTokenHash === 1,
    )

    const expirationIndex = indexes.find(
      ([fields]) => fields.expiresAt === 1,
    )

    const userIndex = indexes.find(
      ([fields]) =>
        fields.userId === 1 &&
        fields.revokedAt === 1,
    )

    const familyIndex = indexes.find(
      ([fields]) =>
        fields.familyId === 1 &&
        fields.revokedAt === 1,
    )

    expect(refreshTokenIndex?.[1]).toMatchObject({
      unique: true,
      name: 'sessions_refresh_token_hash_unique',
    })

    expect(expirationIndex?.[1]).toMatchObject({
      expireAfterSeconds: 0,
      name: 'sessions_expires_at_ttl',
    })

    expect(userIndex?.[1]).toMatchObject({
      name: 'sessions_user_revoked',
    })

    expect(familyIndex?.[1]).toMatchObject({
      name: 'sessions_family_revoked',
    })
  })
})