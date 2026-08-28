import { AppError } from '../errors/AppError.js'
import { env } from '../config/env.js'

export function requirePilotAvatarFeature(
  _req,
  _res,
  next,
) {
  if (!env.pilotAvatarEnabled) {
    next(
      new AppError(
        'The avatar feature is not available in this pilot.',
        {
          statusCode: 404,
          code: 'PILOT_AVATAR_DISABLED',
        },
      ),
    )
    return
  }

  next()
}
