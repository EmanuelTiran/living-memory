import { env } from '../../config/env.js'
import { AppError } from '../../errors/AppError.js'

function createInvalidGoogleOriginError() {
  return new AppError(
    'Google authentication request origin is invalid.',
    {
      statusCode: 403,
      code: 'GOOGLE_AUTH_INVALID',
    },
  )
}

function createGoogleNotConfiguredError() {
  return new AppError(
    'Google authentication is not configured.',
    {
      statusCode: 503,
      code: 'GOOGLE_AUTH_NOT_CONFIGURED',
    },
  )
}

export function requireGoogleAuthOrigin(
  req,
  _res,
  next,
) {
  if (!env.googleClientId) {
    next()
    return
  }

  if (!env.publicAppUrl) {
    next(createGoogleNotConfiguredError())
    return
  }

  const expectedOrigin = new URL(
    env.publicAppUrl,
  ).origin
  const requestOrigin = req.get('origin')

  if (requestOrigin !== expectedOrigin) {
    next(createInvalidGoogleOriginError())
    return
  }

  next()
}
