import { timingSafeEqual } from 'node:crypto'
import { AppError } from '../../errors/AppError.js'

const GOOGLE_CSRF_COOKIE_NAME = 'g_csrf_token'
const MAX_GOOGLE_CSRF_TOKEN_BYTES = 2_048

function createInvalidGoogleCsrfError() {
  return new AppError(
    'Google authentication request could not be verified.',
    {
      statusCode: 403,
      code: 'GOOGLE_AUTH_INVALID',
    },
  )
}

function tokensMatch(cookieToken, bodyToken) {
  if (
    typeof cookieToken !== 'string' ||
    typeof bodyToken !== 'string'
  ) {
    return false
  }

  const cookieBuffer = Buffer.from(
    cookieToken,
    'utf8',
  )
  const bodyBuffer = Buffer.from(bodyToken, 'utf8')

  return (
    cookieBuffer.length > 0 &&
    cookieBuffer.length <=
      MAX_GOOGLE_CSRF_TOKEN_BYTES &&
    cookieBuffer.length === bodyBuffer.length &&
    timingSafeEqual(cookieBuffer, bodyBuffer)
  )
}

export function requireGoogleRedirectCsrf(
  req,
  _res,
  next,
) {
  if (
    !tokensMatch(
      req.cookies?.[GOOGLE_CSRF_COOKIE_NAME],
      req.body?.g_csrf_token,
    )
  ) {
    next(createInvalidGoogleCsrfError())
    return
  }

  next()
}
