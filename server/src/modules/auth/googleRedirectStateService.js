import {
  createHash,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import {
  EncryptJWT,
  jwtDecrypt,
} from 'jose'
import { env } from '../../config/env.js'
import { AppError } from '../../errors/AppError.js'
import GoogleRedirectAttempt from './GoogleRedirectAttempt.js'
import {
  googleRedirectContextSchema,
  googleRedirectStateSchema,
} from './validation.js'

const GOOGLE_REDIRECT_STATE_ISSUER =
  'living-memory-api'
const GOOGLE_REDIRECT_STATE_AUDIENCE =
  'living-memory-google-redirect'
const GOOGLE_REDIRECT_STATE_TTL_SECONDS = 10 * 60
const GOOGLE_REDIRECT_AUTHENTICATION_TYPE =
  'google-redirect-authentication'
const GOOGLE_REDIRECT_RECOVERY_TYPE =
  'google-redirect-recovery'
const GOOGLE_REDIRECT_BINDING_COOKIE_PREFIX =
  'living_memory_google_redirect_'
const GOOGLE_REDIRECT_BINDING_COOKIE_PATH =
  '/api/auth/google/redirect'
const GOOGLE_REDIRECT_RECOVERY_COOKIE_PATH =
  '/api/auth/google/redirect-state/resolve'
const GOOGLE_REDIRECT_BINDING_ID_PATTERN =
  /^[A-Za-z0-9_-]{22}$/
const HASH_PATTERN = /^[a-f0-9]{64}$/

export const googleRedirectRecoveryCookieName =
  'living_memory_google_recovery'

const encryptionKey = Buffer.from(
  hkdfSync(
    'sha256',
    env.accessTokenSecret,
    'living-memory-auth-key-derivation-v1',
    'google-redirect-state-encryption-v1',
    32,
  ),
)

const defaultStateStore = Object.freeze({
  create(record) {
    return GoogleRedirectAttempt.create(record)
  },
  consume(filter) {
    return GoogleRedirectAttempt.findOneAndDelete(
      filter,
    )
  },
})

function createInvalidGoogleStateError() {
  return new AppError(
    'Google authentication state is invalid or expired.',
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

function getConfiguredAppOrigin() {
  if (!env.googleClientId || !env.publicAppUrl) {
    throw createGoogleNotConfiguredError()
  }

  const appUrl = new URL(env.publicAppUrl)

  if (
    appUrl.protocol !== 'https:' &&
    ![
      'localhost',
      '127.0.0.1',
      '[::1]',
    ].includes(appUrl.hostname)
  ) {
    throw createGoogleNotConfiguredError()
  }

  return appUrl.origin
}

function hashValue(value) {
  return createHash('sha256')
    .update(value, 'utf8')
    .digest('hex')
}

function valuesMatch(left, right) {
  if (
    typeof left !== 'string' ||
    typeof right !== 'string'
  ) {
    return false
  }

  const leftBuffer = Buffer.from(left, 'utf8')
  const rightBuffer = Buffer.from(right, 'utf8')

  return (
    leftBuffer.length > 0 &&
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  )
}

function createBindingCookieName(bindingId) {
  if (
    typeof bindingId !== 'string' ||
    !GOOGLE_REDIRECT_BINDING_ID_PATTERN.test(
      bindingId,
    )
  ) {
    throw createInvalidGoogleStateError()
  }

  return `${GOOGLE_REDIRECT_BINDING_COOKIE_PREFIX}${bindingId}`
}

function createCookieOptions({
  expiresAt,
  path,
  sameSite,
}) {
  const options = {
    httpOnly: true,
    secure: true,
    sameSite,
    path,
  }

  if (expiresAt) {
    options.expires = expiresAt
  }

  return options
}

export function createGoogleRedirectBindingCookieOptions(
  expiresAt,
) {
  return createCookieOptions({
    expiresAt,
    path: GOOGLE_REDIRECT_BINDING_COOKIE_PATH,
    sameSite: 'none',
  })
}

export function createClearGoogleRedirectBindingCookieOptions() {
  return createGoogleRedirectBindingCookieOptions()
}

export function createGoogleRedirectRecoveryCookieOptions(
  expiresAt,
) {
  return createCookieOptions({
    expiresAt,
    path: GOOGLE_REDIRECT_RECOVERY_COOKIE_PATH,
    sameSite: 'strict',
  })
}

export function createClearGoogleRedirectRecoveryCookieOptions() {
  return createGoogleRedirectRecoveryCookieOptions()
}

async function createEncryptedState(
  input,
  tokenType,
  {
    key = encryptionKey,
    currentDate = new Date(),
    stateStore = defaultStateStore,
    browserBound = false,
  } = {},
) {
  const context =
    googleRedirectContextSchema.parse(input)
  const issuedAt = Math.floor(
    currentDate.getTime() / 1000,
  )
  const expiresAt = new Date(
    (issuedAt +
      GOOGLE_REDIRECT_STATE_TTL_SECONDS) *
      1000,
  )
  const stateId = randomBytes(32).toString(
    'base64url',
  )
  const stateIdHash = hashValue(stateId)
  const bindingId = browserBound
    ? randomBytes(16).toString('base64url')
    : undefined
  const bindingSecret = browserBound
    ? randomBytes(32).toString('base64url')
    : undefined

  const state = await new EncryptJWT({
    tokenType,
    appOrigin: getConfiguredAppOrigin(),
    ...context,
    ...(browserBound
      ? {
          bindingId,
          bindingHash:
            hashValue(bindingSecret),
        }
      : {}),
  })
    .setProtectedHeader({
      alg: 'dir',
      enc: 'A256GCM',
      typ: 'JWT',
    })
    .setIssuer(GOOGLE_REDIRECT_STATE_ISSUER)
    .setAudience(GOOGLE_REDIRECT_STATE_AUDIENCE)
    .setJti(stateId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(
      issuedAt +
        GOOGLE_REDIRECT_STATE_TTL_SECONDS,
    )
    .encrypt(key)

  await stateStore.create({
    stateIdHash,
    expiresAt,
  })

  return {
    state,
    expiresAt,
    ...(browserBound
      ? {
          bindingCookieName:
            createBindingCookieName(bindingId),
          bindingSecret,
        }
      : {}),
  }
}

async function decryptState(
  state,
  expectedType,
  {
    key = encryptionKey,
    currentDate = new Date(),
  } = {},
) {
  const validatedState =
    googleRedirectStateSchema.parse(state)
  const { payload } = await jwtDecrypt(
    validatedState,
    key,
    {
      keyManagementAlgorithms: ['dir'],
      contentEncryptionAlgorithms: [
        'A256GCM',
      ],
      issuer: GOOGLE_REDIRECT_STATE_ISSUER,
      audience:
        GOOGLE_REDIRECT_STATE_AUDIENCE,
      typ: 'JWT',
      currentDate,
      requiredClaims: [
        'appOrigin',
        'exp',
        'iat',
        'iss',
        'aud',
        'jti',
        'tokenType',
      ],
    },
  )
  const currentTime = Math.floor(
    currentDate.getTime() / 1000,
  )

  if (
    payload.tokenType !== expectedType ||
    payload.appOrigin !==
      getConfiguredAppOrigin() ||
    typeof payload.jti !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(payload.jti) ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number' ||
    payload.iat > currentTime + 5 ||
    payload.exp - payload.iat !==
      GOOGLE_REDIRECT_STATE_TTL_SECONDS
  ) {
    throw createInvalidGoogleStateError()
  }

  return {
    payload,
    context: googleRedirectContextSchema.parse({
      mode: payload.mode,
      returnTo: payload.returnTo,
      invitationToken:
        payload.invitationToken,
    }),
  }
}

async function consumeStateId(
  stateId,
  currentDate,
  stateStore,
) {
  const consumed = await stateStore.consume({
    stateIdHash: hashValue(stateId),
    expiresAt: {
      $gt: currentDate,
    },
  })

  if (!consumed) {
    throw createInvalidGoogleStateError()
  }
}

export async function createGoogleRedirectState(
  input,
  options = {},
) {
  return createEncryptedState(
    input,
    GOOGLE_REDIRECT_AUTHENTICATION_TYPE,
    {
      ...options,
      browserBound: true,
    },
  )
}

export async function consumeGoogleRedirectState(
  state,
  cookies,
  {
    key = encryptionKey,
    currentDate = new Date(),
    stateStore = defaultStateStore,
  } = {},
) {
  try {
    const { payload, context } =
      await decryptState(
        state,
        GOOGLE_REDIRECT_AUTHENTICATION_TYPE,
        {
          key,
          currentDate,
        },
      )
    const bindingCookieName =
      createBindingCookieName(
        payload.bindingId,
      )
    const bindingHash =
      typeof payload.bindingHash === 'string' &&
      HASH_PATTERN.test(payload.bindingHash)
        ? payload.bindingHash
        : ''
    const presentedBindingSecret =
      cookies?.[bindingCookieName]

    if (
      !valuesMatch(
        bindingHash,
        hashValue(
          typeof presentedBindingSecret ===
            'string'
            ? presentedBindingSecret
            : '',
        ),
      )
    ) {
      throw createInvalidGoogleStateError()
    }

    await consumeStateId(
      payload.jti,
      currentDate,
      stateStore,
    )

    return {
      context,
      bindingCookieName,
    }
  } catch (error) {
    if (
      error?.code ===
      'GOOGLE_AUTH_NOT_CONFIGURED'
    ) {
      throw error
    }

    throw createInvalidGoogleStateError()
  }
}

export async function createGoogleRedirectRecoveryState(
  input,
  options = {},
) {
  return createEncryptedState(
    input,
    GOOGLE_REDIRECT_RECOVERY_TYPE,
    options,
  )
}

export async function consumeGoogleRedirectRecoveryState(
  state,
  {
    key = encryptionKey,
    currentDate = new Date(),
    stateStore = defaultStateStore,
  } = {},
) {
  try {
    const { payload, context } =
      await decryptState(
        state,
        GOOGLE_REDIRECT_RECOVERY_TYPE,
        {
          key,
          currentDate,
        },
      )

    await consumeStateId(
      payload.jti,
      currentDate,
      stateStore,
    )

    return context
  } catch (error) {
    if (
      error?.code ===
      'GOOGLE_AUTH_NOT_CONFIGURED'
    ) {
      throw error
    }

    throw createInvalidGoogleStateError()
  }
}

export function getGoogleRedirectLoginUri() {
  return new URL(
    '/api/auth/google/redirect',
    getConfiguredAppOrigin(),
  ).toString()
}
