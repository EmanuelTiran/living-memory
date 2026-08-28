import { createHash } from 'node:crypto'
import { env } from '../../config/env.js'
import { AppError } from '../../errors/AppError.js'
import MemoryInvitation from '../memories/MemoryInvitation.js'

function createInvitationRequiredError() {
  return new AppError(
    'Registration is available by invitation only.',
    {
      statusCode: 403,
      code: 'REGISTRATION_INVITATION_REQUIRED',
    },
  )
}

function createInvalidInvitationError() {
  return new AppError(
    'The invitation is invalid, expired, or intended for another email.',
    {
      statusCode: 403,
      code: 'REGISTRATION_INVITATION_INVALID',
    },
  )
}

function hashInvitationToken(token) {
  return createHash('sha256')
    .update(token)
    .digest('hex')
}

export async function requireRegistrationInvitation(
  {
    email,
    invitationToken,
  },
  {
    inviteOnly = env.pilotInviteOnly,
    now = new Date(),
  } = {},
) {
  if (!inviteOnly) {
    return
  }

  if (!invitationToken) {
    throw createInvitationRequiredError()
  }

  const invitationExists =
    await MemoryInvitation.exists({
      tokenHash:
        hashInvitationToken(
          invitationToken,
        ),
      invitedEmail: email,
      status: 'pending',
      expiresAt: {
        $gt: now,
      },
    })

  if (!invitationExists) {
    throw createInvalidInvitationError()
  }
}
