import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

export const MEMORY_ASSET_ACCESS_TTL_SECONDS = 120

export const MEMORY_ASSET_ACCESS_MAX_TTL_SECONDS = 300

const TOKEN_VERSION = 1

const objectIdPattern =
  /^[0-9a-f]{24}$/i

const tokenPattern =
  /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

const noncePattern =
  /^[A-Za-z0-9_-]{16,64}$/

const dispositions = new Set([
  'inline',
  'attachment',
])

function isValidIdentifier(value) {
  return (
    typeof value === 'string' &&
    objectIdPattern.test(value)
  )
}

function isValidDisposition(value) {
  return dispositions.has(value)
}

function createSigningKey(secret) {
  if (
    typeof secret !== 'string' ||
    secret.length < 32
  ) {
    throw new TypeError(
      'Memory asset access secret must contain at least 32 characters.',
    )
  }

  return createHmac(
    'sha256',
    secret,
  )
    .update(
      'living-memory:memory-asset-access:v1',
    )
    .digest()
}

function createSignature(
  signingKey,
  payloadSegment,
) {
  return createHmac(
    'sha256',
    signingKey,
  )
    .update(payloadSegment)
    .digest('base64url')
}

function signaturesMatch(
  expectedSignature,
  receivedSignature,
) {
  const expectedBuffer = Buffer.from(
    expectedSignature,
    'utf8',
  )

  const receivedBuffer = Buffer.from(
    receivedSignature,
    'utf8',
  )

  return (
    expectedBuffer.length ===
      receivedBuffer.length &&
    timingSafeEqual(
      expectedBuffer,
      receivedBuffer,
    )
  )
}

function hasExpectedPayloadShape(payload) {
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    return false
  }

  const keys = Object.keys(payload).sort()

  return (
    keys.join(',') ===
      'assetId,disposition,expiresAt,issuedAt,memoryId,nonce,version' &&
    payload.version === TOKEN_VERSION &&
    isValidIdentifier(payload.memoryId) &&
    isValidIdentifier(payload.assetId) &&
    isValidDisposition(payload.disposition) &&
    Number.isInteger(payload.issuedAt) &&
    Number.isInteger(payload.expiresAt) &&
    typeof payload.nonce === 'string' &&
    noncePattern.test(payload.nonce)
  )
}

function createNonce() {
  return randomBytes(18).toString(
    'base64url',
  )
}

export function createMemoryAssetAccessTokenService({
  secret,
  now = Date.now,
  generateNonce = createNonce,
} = {}) {
  const signingKey = createSigningKey(
    secret,
  )

  if (typeof now !== 'function') {
    throw new TypeError(
      'Memory asset access clock must be a function.',
    )
  }

  if (typeof generateNonce !== 'function') {
    throw new TypeError(
      'Memory asset access nonce generator must be a function.',
    )
  }

  function sign({
    memoryId,
    assetId,
    disposition,
    ttlSeconds =
      MEMORY_ASSET_ACCESS_TTL_SECONDS,
  }) {
    if (
      !isValidIdentifier(memoryId) ||
      !isValidIdentifier(assetId) ||
      !isValidDisposition(disposition)
    ) {
      throw new TypeError(
        'Memory asset access grant is invalid.',
      )
    }

    if (
      !Number.isInteger(ttlSeconds) ||
      ttlSeconds < 1 ||
      ttlSeconds >
        MEMORY_ASSET_ACCESS_MAX_TTL_SECONDS
    ) {
      throw new TypeError(
        'Memory asset access lifetime is invalid.',
      )
    }

    const nonce = generateNonce()

    if (
      typeof nonce !== 'string' ||
      !noncePattern.test(nonce)
    ) {
      throw new TypeError(
        'Memory asset access nonce is invalid.',
      )
    }

    const issuedAt = Math.floor(
      now() / 1000,
    )

    const expiresAt =
      issuedAt + ttlSeconds

    const payloadSegment = Buffer.from(
      JSON.stringify({
        version: TOKEN_VERSION,
        memoryId,
        assetId,
        disposition,
        issuedAt,
        expiresAt,
        nonce,
      }),
      'utf8',
    ).toString('base64url')

    const signature = createSignature(
      signingKey,
      payloadSegment,
    )

    return Object.freeze({
      token:
        `${payloadSegment}.${signature}`,
      expiresAt: new Date(
        expiresAt * 1000,
      ).toISOString(),
    })
  }

  function verify({
    token,
    memoryId,
    assetId,
  }) {
    try {
      if (
        typeof token !== 'string' ||
        token.length > 1000 ||
        !tokenPattern.test(token) ||
        !isValidIdentifier(memoryId) ||
        !isValidIdentifier(assetId)
      ) {
        return null
      }

      const [
        payloadSegment,
        receivedSignature,
      ] = token.split('.')

      const expectedSignature =
        createSignature(
          signingKey,
          payloadSegment,
        )

      if (
        !signaturesMatch(
          expectedSignature,
          receivedSignature,
        )
      ) {
        return null
      }

      const payload = JSON.parse(
        Buffer.from(
          payloadSegment,
          'base64url',
        ).toString('utf8'),
      )

      if (!hasExpectedPayloadShape(payload)) {
        return null
      }

      const currentTime = Math.floor(
        now() / 1000,
      )

      if (
        payload.memoryId !== memoryId ||
        payload.assetId !== assetId ||
        payload.issuedAt > currentTime + 5 ||
        payload.expiresAt <= currentTime ||
        payload.expiresAt <=
          payload.issuedAt ||
        payload.expiresAt -
          payload.issuedAt >
          MEMORY_ASSET_ACCESS_MAX_TTL_SECONDS
      ) {
        return null
      }

      return Object.freeze({
        disposition:
          payload.disposition,
        expiresAt: new Date(
          payload.expiresAt * 1000,
        ).toISOString(),
      })
    } catch {
      return null
    }
  }

  return Object.freeze({
    sign,
    verify,
  })
}
