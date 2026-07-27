import { AppError } from '../../errors/AppError.js'
import User from './User.js'
import {
  hashPassword,
  passwordNeedsRehash,
  verifyPassword,
} from './password.js'
import { createRefreshSession } from './sessionService.js'
import { createAccessToken } from './tokens.js'
import {
  loginSchema,
  registerSchema,
} from './validation.js'

function createEmailConflictError() {
  return new AppError(
    'An account with this email already exists.',
    {
      statusCode: 409,
      code: 'EMAIL_ALREADY_REGISTERED',
    },
  )
}

function createInvalidCredentialsError() {
  return new AppError(
    'Email or password is incorrect.',
    {
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    },
  )
}

function createSuspendedAccountError() {
  return new AppError(
    'This account has been suspended.',
    {
      statusCode: 403,
      code: 'ACCOUNT_SUSPENDED',
    },
  )
}

export async function registerUser(input) {
  const registrationData = registerSchema.parse(input)

  const existingUser = await User.exists({
    email: registrationData.email,
  })

  if (existingUser) {
    throw createEmailConflictError()
  }

  const passwordHash = await hashPassword(
    registrationData.password,
  )

  try {
    const user = await User.create({
      displayName: registrationData.displayName,
      email: registrationData.email,
      passwordHash,
    })

    return user.toJSON()
  } catch (error) {
    if (error?.code === 11000) {
      throw createEmailConflictError()
    }

    throw error
  }
}

export async function loginUser(input) {
  const credentials = loginSchema.parse(input)

  const user = await User.findOne({
    email: credentials.email,
  }).select('+passwordHash')

  if (!user) {
    await hashPassword(credentials.password)
    throw createInvalidCredentialsError()
  }

  const passwordMatches = await verifyPassword(
    user.passwordHash,
    credentials.password,
  )

  if (!passwordMatches) {
    throw createInvalidCredentialsError()
  }

  if (user.status !== 'active') {
    throw createSuspendedAccountError()
  }

  if (passwordNeedsRehash(user.passwordHash)) {
    user.passwordHash = await hashPassword(
      credentials.password,
    )

    await user.save()
  }

  const userId = user._id.toString()

  const accessToken = await createAccessToken({
    userId,
    systemRole: user.systemRole,
  })

  const refreshSession = await createRefreshSession({
    userId,
  })

  return {
    user: user.toJSON(),
    accessToken,
    refreshToken: refreshSession.refreshToken,
    refreshTokenExpiresAt: refreshSession.expiresAt,
  }
}