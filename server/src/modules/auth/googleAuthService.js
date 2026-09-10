import { AppError } from '../../errors/AppError.js'
import User from './User.js'
import {
  assertUserCanAuthenticate,
  createAuthenticationForUser,
} from './authService.js'
import {
  verifyGoogleCredential,
} from './googleIdentityService.js'
import {
  requireRegistrationInvitation,
} from './registrationAccessService.js'
import {
  googleAuthenticationSchema,
} from './validation.js'

function createGoogleLinkRequiredError() {
  return new AppError(
    'This email is already associated with an account that requires verified linking.',
    {
      statusCode: 409,
      code: 'GOOGLE_ACCOUNT_LINK_REQUIRED',
    },
  )
}

function createGoogleRegistrationUnavailableError() {
  return new AppError(
    'This Google email cannot be used for automatic registration.',
    {
      statusCode: 403,
      code: 'GOOGLE_REGISTRATION_UNAVAILABLE',
    },
  )
}

function isDuplicateKeyError(error) {
  return error?.code === 11000
}

async function findByGoogleSubject(subject) {
  return User.findOne({
    googleSubject: subject,
  }).select('+googleSubject')
}

async function findByEmail(email) {
  return User.findOne({
    email,
  }).select('+googleSubject')
}

function createNewUserDisplayName(identity) {
  const candidates = [
    identity.displayName,
    identity.email
      .split('@')[0]
      .replace(/[._-]+/g, ' '),
    'משתמש/ת זיכרון חי',
  ]

  for (const value of candidates) {
    const candidate = value
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 80)
      .trim()

    if (candidate.length >= 2) {
      return candidate
    }
  }

  return 'משתמש/ת זיכרון חי'
}

async function authenticateLinkedUser(user, identity) {
  assertUserCanAuthenticate(user)

  if (
    user.email === identity.email ||
    !identity.isAuthoritativeEmail
  ) {
    return createAuthenticationForUser(user)
  }

  let updatedUser

  try {
    updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        email: user.email,
        googleSubject: identity.subject,
        status: 'active',
      },
      {
        $set: {
          email: identity.email,
        },
        $unset: {
          passwordResetTokenHash: 1,
          passwordResetExpiresAt: 1,
        },
      },
      {
        returnDocument: 'after',
        runValidators: true,
      },
    ).select('+googleSubject')
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw createGoogleLinkRequiredError()
    }

    throw error
  }

  if (updatedUser) {
    return createAuthenticationForUser(updatedUser)
  }

  const currentUser = await findByGoogleSubject(
    identity.subject,
  )

  if (
    currentUser?.email === identity.email
  ) {
    return createAuthenticationForUser(currentUser)
  }

  throw createGoogleLinkRequiredError()
}

async function authenticateSubjectOwner(
  subject,
  identity,
) {
  const subjectUser =
    await findByGoogleSubject(subject)

  if (!subjectUser) {
    return null
  }

  return authenticateLinkedUser(
    subjectUser,
    identity,
  )
}

async function createGoogleUser(
  identity,
  invitationToken,
) {
  if (!identity.isAuthoritativeEmail) {
    throw createGoogleRegistrationUnavailableError()
  }

  await requireRegistrationInvitation({
    email: identity.email,
    invitationToken,
  })

  try {
    const user = await User.create({
      displayName:
        createNewUserDisplayName(identity),
      email: identity.email,
      googleSubject: identity.subject,
    })

    return createAuthenticationForUser(user)
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error
    }

    const subjectAuthentication =
      await authenticateSubjectOwner(
        identity.subject,
        identity,
      )

    if (subjectAuthentication) {
      return subjectAuthentication
    }

    const emailUser = await findByEmail(
      identity.email,
    )

    if (emailUser) {
      throw createGoogleLinkRequiredError()
    }

    throw error
  }
}

export async function authenticateWithGoogle(input) {
  const authenticationData =
    googleAuthenticationSchema.parse(input)
  const identity = await verifyGoogleCredential(
    authenticationData.credential,
  )

  const linkedUser =
    await findByGoogleSubject(
      identity.subject,
    )

  if (linkedUser) {
    return authenticateLinkedUser(
      linkedUser,
      identity,
    )
  }

  const emailUser = await findByEmail(
    identity.email,
  )

  if (emailUser) {
    throw createGoogleLinkRequiredError()
  }

  return createGoogleUser(
    identity,
    authenticationData.invitationToken,
  )
}
