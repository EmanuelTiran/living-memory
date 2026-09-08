import { AppError } from '../../errors/AppError.js'
import { env } from '../../config/env.js'
import { logger } from '../../utils/logger.js'
import User from './User.js'
import { hashPassword } from './password.js'
import { sendPasswordResetEmail } from './passwordResetMailService.js'
import { revokeAllUserSessions } from './sessionService.js'
import {
  createPasswordResetExpirationDate,
  createPasswordResetToken,
  hashPasswordResetToken,
} from './tokens.js'
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from './validation.js'

function createInvalidResetTokenError() {
  return new AppError(
    'Password reset link is invalid or expired.',
    {
      statusCode: 400,
      code: 'PASSWORD_RESET_INVALID_OR_EXPIRED',
    },
  )
}

async function clearPendingResetToken(
  userId,
  tokenHash,
) {
  try {
    await User.updateOne(
      {
        _id: userId,
        passwordResetTokenHash: tokenHash,
      },
      {
        $unset: {
          passwordResetTokenHash: 1,
          passwordResetExpiresAt: 1,
        },
      },
    )
  } catch (error) {
    logger.error(
      'Password reset token cleanup failed',
      {
        userId: userId.toString(),
        errorName: error?.name,
      },
    )
  }
}

export async function requestPasswordReset(input) {
  const { email } =
    forgotPasswordSchema.parse(input)
  const token = createPasswordResetToken()
  const tokenHash =
    hashPasswordResetToken(token)
  const expiresAt =
    createPasswordResetExpirationDate()

  const user = await User.findOneAndUpdate(
    {
      email,
      status: 'active',
    },
    {
      $set: {
        passwordResetTokenHash: tokenHash,
      },
      $unset: {
        passwordResetExpiresAt: 1,
      },
    },
    {
      returnDocument: 'after',
    },
  )

  if (!user) {
    return
  }

  try {
    const resetUrl = new URL(
      '/reset-password',
      env.publicAppUrl,
    )

    resetUrl.searchParams.set('token', token)

    await sendPasswordResetEmail({
      to: user.email,
      resetUrl: resetUrl.toString(),
    })

    await User.updateOne(
      {
        _id: user._id,
        passwordResetTokenHash: tokenHash,
      },
      {
        $set: {
          passwordResetExpiresAt: expiresAt,
        },
      },
    )
  } catch (error) {
    await clearPendingResetToken(
      user._id,
      tokenHash,
    )

    logger.error(
      'Password reset email delivery failed',
      {
        userId: user._id.toString(),
        errorName: error?.name,
      },
    )
  }
}

export async function resetPassword(input) {
  const resetData =
    resetPasswordSchema.parse(input)
  const tokenHash =
    hashPasswordResetToken(resetData.token)
  const passwordHash = await hashPassword(
    resetData.password,
  )
  const now = new Date()

  const user = await User.findOneAndUpdate(
    {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: {
        $gt: now,
      },
      status: 'active',
    },
    {
      $set: {
        passwordHash,
      },
      $unset: {
        passwordResetTokenHash: 1,
        passwordResetExpiresAt: 1,
      },
    },
    {
      returnDocument: 'after',
    },
  )

  if (!user) {
    throw createInvalidResetTokenError()
  }

  await revokeAllUserSessions(
    user._id.toString(),
    'security',
  )
}
