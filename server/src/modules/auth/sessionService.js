import { randomUUID } from 'node:crypto'
import { AppError } from '../../errors/AppError.js'
import Session from './Session.js'
import {
  createRefreshToken,
  createRefreshTokenExpirationDate,
  hashRefreshToken,
} from './tokens.js'

const allowedRevocationReasons = new Set([
  'rotated',
  'logout',
  'reuse_detected',
  'security',
])

function createInvalidRefreshTokenError() {
  return new AppError(
    'Refresh token is invalid or expired.',
    {
      statusCode: 401,
      code: 'INVALID_REFRESH_TOKEN',
    },
  )
}

function validateRequiredString(value, fieldName) {
  if (
    typeof value !== 'string' ||
    value.length === 0
  ) {
    throw new TypeError(
      `${fieldName} must be a non-empty string.`,
    )
  }
}

function validateRevocationReason(reason) {
  if (!allowedRevocationReasons.has(reason)) {
    throw new TypeError(
      'Session revocation reason is invalid.',
    )
  }
}

export async function createRefreshSession({
  userId,
  familyId = randomUUID(),
}) {
  validateRequiredString(userId, 'User ID')
  validateRequiredString(
    familyId,
    'Session family ID',
  )

  const refreshToken = createRefreshToken()

  const refreshTokenHash =
    hashRefreshToken(refreshToken)

  const expiresAt =
    createRefreshTokenExpirationDate()

  const session = await Session.create({
    userId,
    refreshTokenHash,
    familyId,
    expiresAt,
  })

  return {
    refreshToken,
    sessionId: session._id.toString(),
    familyId: session.familyId,
    expiresAt: session.expiresAt,
  }
}

export async function revokeRefreshSessionFamily(
  familyId,
  reason = 'security',
) {
  validateRequiredString(
    familyId,
    'Session family ID',
  )

  validateRevocationReason(reason)

  const revokedAt = new Date()

  await Session.updateMany(
    {
      familyId,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt,
        revocationReason: reason,
      },
    },
  )
}

export async function rotateRefreshSession(
  refreshToken,
) {
  const refreshTokenHash =
    hashRefreshToken(refreshToken)

  const currentSession = await Session.findOne({
    refreshTokenHash,
  })

  if (!currentSession) {
    throw createInvalidRefreshTokenError()
  }

  if (currentSession.revokedAt) {
    await revokeRefreshSessionFamily(
      currentSession.familyId,
      'reuse_detected',
    )

    throw createInvalidRefreshTokenError()
  }

  const now = new Date()

  if (
    !(currentSession.expiresAt instanceof Date) ||
    currentSession.expiresAt.getTime() <=
      now.getTime()
  ) {
    throw createInvalidRefreshTokenError()
  }

  const claimedSession =
    await Session.findOneAndUpdate(
      {
        _id: currentSession._id,
        revokedAt: null,
        expiresAt: {
          $gt: now,
        },
      },
      {
        $set: {
          revokedAt: now,
          revocationReason: 'rotated',
          lastUsedAt: now,
        },
      },
      {
        returnDocument: 'after',
      },
    )

  if (!claimedSession) {
    await revokeRefreshSessionFamily(
      currentSession.familyId,
      'reuse_detected',
    )

    throw createInvalidRefreshTokenError()
  }

  const nextSession = await createRefreshSession({
    userId: currentSession.userId.toString(),
    familyId: currentSession.familyId,
  })

  await Session.updateOne(
    {
      _id: currentSession._id,
    },
    {
      $set: {
        replacedBySessionId:
          nextSession.sessionId,
      },
    },
  )

  return {
    ...nextSession,
    userId: currentSession.userId.toString(),
  }
}

export async function revokeRefreshSession(
  refreshToken,
) {
  const refreshTokenHash =
    hashRefreshToken(refreshToken)

  const revokedAt = new Date()

  await Session.findOneAndUpdate(
    {
      refreshTokenHash,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt,
        revocationReason: 'logout',
        lastUsedAt: revokedAt,
      },
    },
  )
}