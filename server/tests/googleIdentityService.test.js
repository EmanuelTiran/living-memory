import {
  generateKeyPair,
  SignJWT,
} from 'jose'
import {
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest'
import {
  verifyGoogleCredential,
} from '../src/modules/auth/googleIdentityService.js'

const clientId =
  '123456789-test.apps.googleusercontent.com'
const now = Math.floor(Date.now() / 1000)

let privateKey
let publicKey
let otherPrivateKey

beforeAll(async () => {
  const primaryKeys = await generateKeyPair(
    'RS256',
  )
  const otherKeys = await generateKeyPair(
    'RS256',
  )

  privateKey = primaryKeys.privateKey
  publicKey = primaryKeys.publicKey
  otherPrivateKey = otherKeys.privateKey
})

async function createCredential({
  claims = {},
  audience = clientId,
  issuer = 'https://accounts.google.com',
  issuedAt = now,
  expirationTime = now + 5 * 60,
  omittedClaims = [],
  signingKey = privateKey,
} = {}) {
  const payload = {
    sub: 'google-subject-123',
    email: 'User@Gmail.com',
    email_verified: true,
    name: '  Test   User  ',
    ...claims,
  }

  for (const claim of omittedClaims) {
    delete payload[claim]
  }

  let token = new SignJWT(payload)
    .setProtectedHeader({
      alg: 'RS256',
      kid: 'test-key',
    })

  if (!omittedClaims.includes('iss')) {
    token = token.setIssuer(issuer)
  }

  if (!omittedClaims.includes('aud')) {
    token = token.setAudience(audience)
  }

  if (!omittedClaims.includes('iat')) {
    token = token.setIssuedAt(issuedAt)
  }

  if (!omittedClaims.includes('exp')) {
    token = token.setExpirationTime(
      expirationTime,
    )
  }

  return token.sign(signingKey)
}

async function verify(credential) {
  return verifyGoogleCredential(credential, {
    clientId,
    keySet: publicKey,
  })
}

function expectInvalidGoogleCredential(promise) {
  return expect(promise).rejects.toMatchObject({
    statusCode: 401,
    code: 'GOOGLE_AUTH_INVALID',
  })
}

describe('Google identity verification', () => {
  it('accepts a valid signed Google credential', async () => {
    const credential = await createCredential()

    await expect(verify(credential)).resolves.toEqual({
      subject: 'google-subject-123',
      email: 'user@gmail.com',
      displayName: 'Test User',
      hostedDomain: '',
      isAuthoritativeEmail: true,
    })
  })

  it('accepts the alternate documented Google issuer', async () => {
    const credential = await createCredential({
      issuer: 'accounts.google.com',
    })

    await expect(verify(credential)).resolves.toMatchObject({
      subject: 'google-subject-123',
      email: 'user@gmail.com',
    })
  })

  it('recognizes a verified Workspace identity as authoritative', async () => {
    const credential = await createCredential({
      claims: {
        email: 'person@example.org',
        hd: 'Example.org',
      },
    })

    await expect(verify(credential)).resolves.toMatchObject({
      email: 'person@example.org',
      hostedDomain: 'example.org',
      isAuthoritativeEmail: true,
    })
  })

  it('does not treat a third-party Google email as authoritative', async () => {
    const credential = await createCredential({
      claims: {
        email: 'person@example.org',
      },
    })

    await expect(verify(credential)).resolves.toMatchObject({
      email: 'person@example.org',
      hostedDomain: '',
      isAuthoritativeEmail: false,
    })
  })

  it('rejects an invalid signature', async () => {
    const credential = await createCredential({
      signingKey: otherPrivateKey,
    })

    await expectInvalidGoogleCredential(
      verify(credential),
    )
  })

  it('rejects the wrong audience', async () => {
    const credential = await createCredential({
      audience:
        '999999999-other.apps.googleusercontent.com',
    })

    await expectInvalidGoogleCredential(
      verify(credential),
    )
  })

  it('rejects a multi-audience credential instead of accepting a partial match', async () => {
    const credential = await createCredential({
      audience: [
        clientId,
        '999999999-other.apps.googleusercontent.com',
      ],
    })

    await expectInvalidGoogleCredential(
      verify(credential),
    )
  })

  it('rejects the wrong issuer', async () => {
    const credential = await createCredential({
      issuer: 'https://malicious.example',
    })

    await expectInvalidGoogleCredential(
      verify(credential),
    )
  })

  it('rejects an expired credential', async () => {
    const credential = await createCredential({
      issuedAt: now - 10 * 60,
      expirationTime: now - 5 * 60,
    })

    await expectInvalidGoogleCredential(
      verify(credential),
    )
  })

  it.each([
    'sub',
    'email',
    'email_verified',
    'exp',
    'iat',
  ])('rejects a missing %s claim', async (claim) => {
    const credential = await createCredential({
      omittedClaims: [claim],
    })

    await expectInvalidGoogleCredential(
      verify(credential),
    )
  })

  it('rejects an unverified email', async () => {
    const credential = await createCredential({
      claims: {
        email_verified: false,
      },
    })

    await expectInvalidGoogleCredential(
      verify(credential),
    )
  })

  it('rejects a string-valued email verification claim', async () => {
    const credential = await createCredential({
      claims: {
        email_verified: 'true',
      },
    })

    await expectInvalidGoogleCredential(
      verify(credential),
    )
  })

  it('rejects a credential issued materially in the future', async () => {
    const credential = await createCredential({
      issuedAt: now + 10 * 60,
      expirationTime: now + 70 * 60,
    })

    await expectInvalidGoogleCredential(
      verify(credential),
    )
  })

  it('rejects an invalid subject shape', async () => {
    const credential = await createCredential({
      claims: {
        sub: 'invalid subject',
      },
    })

    await expectInvalidGoogleCredential(
      verify(credential),
    )
  })

  it('rejects an invalid Workspace hosted domain', async () => {
    const credential = await createCredential({
      claims: {
        email: 'person@example.org',
        hd: '-invalid.example.org',
      },
    })

    await expectInvalidGoogleCredential(
      verify(credential),
    )
  })

  it('fails safely when Google is not configured', async () => {
    const credential = await createCredential()

    await expect(
      verifyGoogleCredential(credential, {
        clientId: '',
        keySet: publicKey,
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'GOOGLE_AUTH_NOT_CONFIGURED',
    })
  })
})
