import {
  createRemoteJWKSet,
  jwtVerify,
} from 'jose'
import { env } from '../../config/env.js'
import { AppError } from '../../errors/AppError.js'
import {
  emailSchema,
  googleCredentialSchema,
} from './validation.js'

const GOOGLE_JWKS_URL = new URL(
  'https://www.googleapis.com/oauth2/v3/certs',
)
const GOOGLE_ISSUERS = [
  'accounts.google.com',
  'https://accounts.google.com',
]
const googleKeySet = createRemoteJWKSet(
  GOOGLE_JWKS_URL,
  {
    timeoutDuration: 5_000,
    cooldownDuration: 30_000,
    cacheMaxAge: 10 * 60 * 1000,
  },
)

function createInvalidGoogleCredentialError() {
  return new AppError(
    'Google authentication could not be verified.',
    {
      statusCode: 401,
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

function normalizeHostedDomain(value) {
  if (value === undefined) {
    return ''
  }

  const labels =
    typeof value === 'string'
      ? value.split('.')
      : []

  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 253 ||
    labels.some(
      (label) =>
        label.length === 0 ||
        label.length > 63 ||
        !/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(
          label,
        ),
    )
  ) {
    throw createInvalidGoogleCredentialError()
  }

  return value.toLowerCase()
}

function normalizeDisplayName(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    .trim()
    .replace(/\s+/g, ' ')
}

function isAuthoritativeGoogleEmail(
  email,
  hostedDomain,
) {
  return (
    email.endsWith('@gmail.com') ||
    hostedDomain.length > 0
  )
}

export async function verifyGoogleCredential(
  credential,
  {
    clientId = env.googleClientId,
    keySet = googleKeySet,
    currentDate,
  } = {},
) {
  if (!clientId) {
    throw createGoogleNotConfiguredError()
  }

  const validatedCredential =
    googleCredentialSchema.parse(credential)
  const verificationDate =
    currentDate ?? new Date()

  let payload

  try {
    const verification = await jwtVerify(
      validatedCredential,
      keySet,
      {
        algorithms: ['RS256'],
        audience: clientId,
        issuer: GOOGLE_ISSUERS,
        requiredClaims: [
          'aud',
          'email',
          'email_verified',
          'exp',
          'iat',
          'iss',
          'sub',
        ],
        currentDate: verificationDate,
      },
    )

    payload = verification.payload
  } catch {
    throw createInvalidGoogleCredentialError()
  }

  try {
    if (
      payload.aud !== clientId ||
      payload.email_verified !== true ||
      !Number.isInteger(payload.iat) ||
      payload.iat >
        Math.floor(
          verificationDate.getTime() / 1000,
        ) + 60 ||
      typeof payload.sub !== 'string' ||
      !/^[A-Za-z0-9_-]{1,255}$/.test(
        payload.sub,
      )
    ) {
      throw createInvalidGoogleCredentialError()
    }

    const email = emailSchema.parse(
      payload.email,
    )
    const hostedDomain =
      normalizeHostedDomain(payload.hd)

    return {
      subject: payload.sub,
      email,
      displayName:
        normalizeDisplayName(payload.name),
      hostedDomain,
      isAuthoritativeEmail:
        isAuthoritativeGoogleEmail(
          email,
          hostedDomain,
        ),
    }
  } catch {
    throw createInvalidGoogleCredentialError()
  }
}
