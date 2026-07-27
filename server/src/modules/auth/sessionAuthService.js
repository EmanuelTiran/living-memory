import { AppError } from '../../errors/AppError.js'
import User from './User.js'
import {
  revokeRefreshSession,
  revokeRefreshSessionFamily,
  rotateRefreshSession,
} from './sessionService.js'
import { createAccessToken } from './tokens.js'

function createInvalidRefreshTokenError() {
  return new AppError(
    'Refresh token is invalid or expired.',
    {
      statusCode: 401,
      code: 'INVALID_REFRESH_TOKEN',
    },
  )
}

function hasRefreshToken(refreshToken) {
  return (
    typeof refreshToken === 'string' &&
    refreshToken.length > 0
  )
}

export async function refreshAuthentication(
  refreshToken,
) {
  if (!hasRefreshToken(refreshToken)) {
    throw createInvalidRefreshTokenError()
  }

  const rotatedSession =
    await rotateRefreshSession(refreshToken)

  const user = await User.findById(
    rotatedSession.userId,
  )

  if (!user || user.status !== 'active') {
    await revokeRefreshSessionFamily(
      rotatedSession.familyId,
      'security',
    )

    throw createInvalidRefreshTokenError()
  }

  const accessToken = await createAccessToken({
    userId: user._id.toString(),
    systemRole: user.systemRole,
  })

  return {
    user: user.toJSON(),
    accessToken,
    refreshToken: rotatedSession.refreshToken,
    refreshTokenExpiresAt:
      rotatedSession.expiresAt,
  }
}

export async function logoutUser(refreshToken) {
  if (!hasRefreshToken(refreshToken)) {
    return
  }

  await revokeRefreshSession(refreshToken)
}