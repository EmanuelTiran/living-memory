import { env } from '../../config/env.js'

export const refreshCookieName =
  'living_memory_refresh'

function createBaseRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/api/auth',
  }
}

export function createRefreshCookieOptions(
  expiresAt,
) {
  if (
    !(expiresAt instanceof Date) ||
    Number.isNaN(expiresAt.getTime())
  ) {
    throw new TypeError(
      'Refresh cookie expiration date must be valid.',
    )
  }

  return {
    ...createBaseRefreshCookieOptions(),
    expires: expiresAt,
  }
}

export function createClearRefreshCookieOptions() {
  return createBaseRefreshCookieOptions()
}