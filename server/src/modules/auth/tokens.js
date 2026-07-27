import {
    createHash,
    randomBytes,
    randomUUID,
  } from 'node:crypto'
  import { SignJWT, jwtVerify } from 'jose'
  import { env } from '../../config/env.js'

  const ACCESS_TOKEN_ISSUER = 'living-memory-api'
  const ACCESS_TOKEN_AUDIENCE = 'living-memory-client'
  const ACCESS_TOKEN_ALGORITHM = 'HS256'
  const REFRESH_TOKEN_BYTES = 48

  const allowedSystemRoles = new Set(['user', 'admin'])

  const accessTokenSecret = new TextEncoder().encode(
    env.accessTokenSecret,
  )

  function validateAccessTokenInput({
    userId,
    systemRole,
  }) {
    if (
      typeof userId !== 'string' ||
      userId.length === 0
    ) {
      throw new TypeError(
        'Access token user ID must be a non-empty string.',
      )
    }

    if (!allowedSystemRoles.has(systemRole)) {
      throw new TypeError(
        'Access token system role is invalid.',
      )
    }
  }

  function validateTokenString(token, tokenName) {
    if (
      typeof token !== 'string' ||
      token.length === 0
    ) {
      throw new TypeError(
        `${tokenName} must be a non-empty string.`,
      )
    }
  }

  export async function createAccessToken({
    userId,
    systemRole,
  }) {
    validateAccessTokenInput({
      userId,
      systemRole,
    })

    const expiresAt =
      Math.floor(Date.now() / 1000) +
      env.accessTokenTtlMinutes * 60

    return new SignJWT({
      tokenType: 'access',
      systemRole,
    })
      .setProtectedHeader({
        alg: ACCESS_TOKEN_ALGORITHM,
        typ: 'JWT',
      })
      .setSubject(userId)
      .setIssuer(ACCESS_TOKEN_ISSUER)
      .setAudience(ACCESS_TOKEN_AUDIENCE)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(accessTokenSecret)
  }

  export async function verifyAccessToken(token) {
    validateTokenString(token, 'Access token')

    const { payload } = await jwtVerify(
      token,
      accessTokenSecret,
      {
        algorithms: [ACCESS_TOKEN_ALGORITHM],
        issuer: ACCESS_TOKEN_ISSUER,
        audience: ACCESS_TOKEN_AUDIENCE,
      },
    )

    const hasValidPayload =
      payload.tokenType === 'access' &&
      typeof payload.sub === 'string' &&
      payload.sub.length > 0 &&
      typeof payload.jti === 'string' &&
      typeof payload.exp === 'number' &&
      allowedSystemRoles.has(payload.systemRole)

    if (!hasValidPayload) {
      throw new Error('Access token payload is invalid.')
    }

    return {
      userId: payload.sub,
      systemRole: payload.systemRole,
      tokenId: payload.jti,
      expiresAt: new Date(payload.exp * 1000),
    }
  }

  export function createRefreshToken() {
    return randomBytes(REFRESH_TOKEN_BYTES).toString(
      'base64url',
    )
  }

  export function hashRefreshToken(refreshToken) {
    validateTokenString(refreshToken, 'Refresh token')

    return createHash('sha256')
      .update(refreshToken, 'utf8')
      .digest('hex')
  }

  export function createRefreshTokenExpirationDate(
    now = new Date(),
  ) {
    if (
      !(now instanceof Date) ||
      Number.isNaN(now.getTime())
    ) {
      throw new TypeError('Current date must be valid.')
    }

    const expiresAt = new Date(now)

    expiresAt.setUTCDate(
      expiresAt.getUTCDate() + env.refreshTokenTtlDays,
    )

    return expiresAt
  }
