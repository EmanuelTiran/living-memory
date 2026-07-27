import { describe, expect, it } from 'vitest'
import {
  createAccessToken,
  createRefreshToken,
  createRefreshTokenExpirationDate,
  hashRefreshToken,
  verifyAccessToken,
} from '../src/modules/auth/tokens.js'

describe('Authentication tokens', () => {
  it('creates and verifies an access token', async () => {
    const token = await createAccessToken({
      userId: 'user-id',
      systemRole: 'user',
    })

    const claims = await verifyAccessToken(token)

    expect(claims).toMatchObject({
      userId: 'user-id',
      systemRole: 'user',
      tokenId: expect.any(String),
      expiresAt: expect.any(Date),
    })

    expect(claims.expiresAt.getTime()).toBeGreaterThan(
      Date.now(),
    )
  })

  it('rejects a modified access token', async () => {
    const token = await createAccessToken({
      userId: 'user-id',
      systemRole: 'user',
    })

    const segments = token.split('.')

    segments[1] =
      (segments[1][0] === 'a' ? 'b' : 'a') +
      segments[1].slice(1)

    const modifiedToken = segments.join('.')

    await expect(
      verifyAccessToken(modifiedToken),
    ).rejects.toThrow()
  })

  it('creates unique refresh tokens and stable hashes', () => {
    const firstToken = createRefreshToken()
    const secondToken = createRefreshToken()

    const firstHash = hashRefreshToken(firstToken)

    expect(firstToken).not.toBe(secondToken)
    expect(firstToken).toHaveLength(64)
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/)

    expect(hashRefreshToken(firstToken)).toBe(firstHash)

    expect(hashRefreshToken(secondToken)).not.toBe(
      firstHash,
    )
  })

  it('calculates the refresh-token expiration date', () => {
    const startDate = new Date(
      '2026-07-26T12:00:00.000Z',
    )

    const expirationDate =
      createRefreshTokenExpirationDate(startDate)

    expect(expirationDate.toISOString()).toBe(
      '2026-08-25T12:00:00.000Z',
    )

    expect(startDate.toISOString()).toBe(
      '2026-07-26T12:00:00.000Z',
    )
  })
})