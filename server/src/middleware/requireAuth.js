import { AppError } from '../errors/AppError.js'
import { verifyAccessToken } from '../modules/auth/tokens.js'

function createAuthenticationError() {
  return new AppError(
    'Authentication is required.',
    {
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
    },
  )
}

function extractBearerToken(req) {
  const authorization = req.get('authorization')

  if (typeof authorization !== 'string') {
    return null
  }

  const parts = authorization.trim().split(/\s+/)

  if (
    parts.length !== 2 ||
    parts[0].toLowerCase() !== 'bearer' ||
    parts[1].length === 0
  ) {
    return null
  }

  return parts[1]
}

export async function requireAuth(req, _res, next) {
  const accessToken = extractBearerToken(req)

  if (!accessToken) {
    next(createAuthenticationError())
    return
  }

  try {
    req.auth = await verifyAccessToken(accessToken)
    next()
  } catch {
    next(createAuthenticationError())
  }
}