import { AppError } from '../../errors/AppError.js'
import User from './User.js'

function createAuthenticationError() {
  return new AppError(
    'Authentication is required.',
    {
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
    },
  )
}

export async function getCurrentUser(userId) {
  if (
    typeof userId !== 'string' ||
    userId.length === 0
  ) {
    throw createAuthenticationError()
  }

  const user = await User.findById(userId)

  if (!user || user.status !== 'active') {
    throw createAuthenticationError()
  }

  return user.toJSON()
}
