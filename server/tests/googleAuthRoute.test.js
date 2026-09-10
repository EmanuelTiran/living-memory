import request from 'supertest'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { AppError } from '../src/errors/AppError.js'

const mocks = vi.hoisted(() => ({
  authenticateWithGoogle: vi.fn(),
  consumeGoogleRedirectRecoveryState:
    vi.fn(),
  consumeGoogleRedirectState: vi.fn(),
  createGoogleRedirectRecoveryState:
    vi.fn(),
  createGoogleRedirectState: vi.fn(),
  getGoogleRedirectLoginUri: vi.fn(),
}))

vi.mock(
  '../src/modules/auth/googleAuthService.js',
  () => ({
    authenticateWithGoogle:
      mocks.authenticateWithGoogle,
  }),
)

vi.mock(
  '../src/modules/auth/googleRedirectStateService.js',
  () => ({
    consumeGoogleRedirectRecoveryState:
      mocks.consumeGoogleRedirectRecoveryState,
    consumeGoogleRedirectState:
      mocks.consumeGoogleRedirectState,
    createClearGoogleRedirectBindingCookieOptions:
      () => ({
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/api/auth/google/redirect',
      }),
    createClearGoogleRedirectRecoveryCookieOptions:
      () => ({
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/api/auth/google/redirect-state/resolve',
      }),
    createGoogleRedirectBindingCookieOptions:
      (expires) => ({
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/api/auth/google/redirect',
        expires,
      }),
    createGoogleRedirectRecoveryCookieOptions:
      (expires) => ({
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/api/auth/google/redirect-state/resolve',
        expires,
      }),
    createGoogleRedirectRecoveryState:
      mocks.createGoogleRedirectRecoveryState,
    createGoogleRedirectState:
      mocks.createGoogleRedirectState,
    getGoogleRedirectLoginUri:
      mocks.getGoogleRedirectLoginUri,
    googleRedirectRecoveryCookieName:
      'living_memory_google_recovery',
  }),
)

import app from '../src/app.js'

const credential =
  `${'a'.repeat(40)}.${'b'.repeat(40)}.${'c'.repeat(40)}`
const redirectState = 'a..c.d.e'
const redirectContext = {
  mode: 'register',
  returnTo: '/invitation?token=invitation',
  invitationToken: 'i'.repeat(43),
}
const bindingCookieName =
  'living_memory_google_redirect_binding'
const bindingSecret = 'b'.repeat(43)
const expiresAt = new Date(
  '2026-10-01T12:10:00.000Z',
)

function createAuthentication() {
  return {
    user: {
      id: 'user-id',
      displayName: 'Google User',
      email: 'user@gmail.com',
      systemRole: 'user',
      status: 'active',
    },
    accessToken: 'signed-access-token',
    refreshToken: 'raw-refresh-token',
    refreshTokenExpiresAt: new Date(
      '2026-10-01T12:00:00.000Z',
    ),
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.createGoogleRedirectState.mockResolvedValue({
    state: redirectState,
    bindingCookieName,
    bindingSecret,
    expiresAt,
  })
  mocks.createGoogleRedirectRecoveryState.mockResolvedValue(
    {
      state: 'recovery..state.with.parts',
      expiresAt,
    },
  )
  mocks.getGoogleRedirectLoginUri.mockReturnValue(
    'https://zikaron-hai.co.il/api/auth/google/redirect',
  )
  mocks.consumeGoogleRedirectState.mockResolvedValue({
    context: redirectContext,
    bindingCookieName,
  })
  mocks.consumeGoogleRedirectRecoveryState.mockResolvedValue(
    redirectContext,
  )
})

describe('POST /api/auth/google', () => {
  it('issues the normal Living Memory auth response and refresh cookie', async () => {
    const authentication = createAuthentication()
    mocks.authenticateWithGoogle.mockResolvedValue(
      authentication,
    )

    const response = await request(app)
      .post('/api/auth/google')
      .send({ credential })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      success: true,
      data: {
        user: authentication.user,
        accessToken: authentication.accessToken,
        accessTokenExpiresInSeconds:
          expect.any(Number),
      },
    })
    expect(response.body).not.toHaveProperty(
      'data.refreshToken',
    )
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'living_memory_refresh=raw-refresh-token',
        ),
      ]),
    )
  })

  it('passes only the credential and optional invitation token to the service', async () => {
    mocks.authenticateWithGoogle.mockResolvedValue(
      createAuthentication(),
    )

    await request(app)
      .post('/api/auth/google')
      .send({
        credential,
        invitationToken: 'i'.repeat(43),
      })

    expect(
      mocks.authenticateWithGoogle,
    ).toHaveBeenCalledWith({
      credential,
      invitationToken: 'i'.repeat(43),
    })
  })

  it('rejects malformed Google credentials before service access', async () => {
    const response = await request(app)
      .post('/api/auth/google')
      .send({
        credential: 'not-a-google-token',
        email: 'attacker@example.com',
      })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe(
      'VALIDATION_ERROR',
    )
    expect(
      mocks.authenticateWithGoogle,
    ).not.toHaveBeenCalled()
  })

  it.each([
    {
      statusCode: 401,
      code: 'GOOGLE_AUTH_INVALID',
    },
    {
      statusCode: 503,
      code: 'GOOGLE_AUTH_NOT_CONFIGURED',
    },
    {
      statusCode: 409,
      code: 'GOOGLE_ACCOUNT_LINK_REQUIRED',
    },
  ])(
    'returns the safe $code application error',
    async ({ statusCode, code }) => {
      mocks.authenticateWithGoogle.mockRejectedValue(
        new AppError(
          'Google authentication failed.',
          {
            statusCode,
            code,
          },
        ),
      )

      const response = await request(app)
        .post('/api/auth/google')
        .send({ credential })

      expect(response.status).toBe(statusCode)
      expect(response.body.error.code).toBe(code)
      expect(
        response.headers['set-cookie'],
      ).toBeUndefined()
      expect(JSON.stringify(response.body)).not.toContain(
        credential,
      )
    },
  )
})

describe('Google redirect authentication routes', () => {
  it('creates opaque state and a cross-site HttpOnly browser-binding cookie', async () => {
    const response = await request(app)
      .post('/api/auth/google/redirect-state')
      .send(redirectContext)

    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe(
      'no-store',
    )
    expect(response.body.data).toEqual({
      state: redirectState,
      loginUri:
        'https://zikaron-hai.co.il/api/auth/google/redirect',
    })
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          `${bindingCookieName}=${bindingSecret}`,
        ),
        expect.stringContaining('HttpOnly'),
        expect.stringContaining('Secure'),
        expect.stringContaining('SameSite=None'),
      ]),
    )
  })

  it('resolves recovery context only from the HttpOnly recovery cookie and clears it', async () => {
    const recoveryState =
      'recovery..state.with.parts'
    const response = await request(app)
      .post(
        '/api/auth/google/redirect-state/resolve',
      )
      .set(
        'Cookie',
        `living_memory_google_recovery=${recoveryState}`,
      )
      .send({})

    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe(
      'no-store',
    )
    expect(response.body.data).toEqual(
      redirectContext,
    )
    expect(
      mocks.consumeGoogleRedirectRecoveryState,
    ).toHaveBeenCalledWith(recoveryState)
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'living_memory_google_recovery=',
        ),
      ]),
    )
  })

  it('does not accept recovery state from a request body', async () => {
    const response = await request(app)
      .post(
        '/api/auth/google/redirect-state/resolve',
      )
      .send({
        state: 'attacker-controlled-state',
      })

    expect(response.status).toBe(400)
    expect(
      mocks.consumeGoogleRedirectRecoveryState,
    ).not.toHaveBeenCalled()
  })

  it('validates Google CSRF, binding, and creates the normal refresh cookie', async () => {
    mocks.authenticateWithGoogle.mockResolvedValue(
      createAuthentication(),
    )

    const response = await request(app)
      .post('/api/auth/google/redirect')
      .set(
        'Cookie',
        `g_csrf_token=csrf-token; ${bindingCookieName}=${bindingSecret}`,
      )
      .type('form')
      .send({
        credential,
        g_csrf_token: 'csrf-token',
        state: redirectState,
        select_by: 'btn',
      })

    expect(response.status).toBe(303)
    expect(response.headers.location).toBe(
      redirectContext.returnTo,
    )
    expect(response.headers['cache-control']).toBe(
      'no-store',
    )
    expect(
      mocks.consumeGoogleRedirectState,
    ).toHaveBeenCalledWith(
      redirectState,
      expect.objectContaining({
        [bindingCookieName]: bindingSecret,
      }),
    )
    expect(
      mocks.authenticateWithGoogle,
    ).toHaveBeenCalledWith({
      credential,
      invitationToken:
        redirectContext.invitationToken,
    })
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'living_memory_refresh=raw-refresh-token',
        ),
        expect.stringContaining(
          `${bindingCookieName}=`,
        ),
      ]),
    )
  })

  it.each([
    {
      label: 'missing',
      cookieToken: undefined,
      bodyToken: 'csrf-token',
    },
    {
      label: 'mismatched',
      cookieToken: 'other-token',
      bodyToken: 'csrf-token',
    },
  ])(
    'rejects a $label Google double-submit CSRF token before consuming state',
    async ({ cookieToken, bodyToken }) => {
      let pendingRequest = request(app)
        .post('/api/auth/google/redirect')
        .type('form')

      if (cookieToken) {
        pendingRequest = pendingRequest.set(
          'Cookie',
          `g_csrf_token=${cookieToken}`,
        )
      }

      const response = await pendingRequest.send({
        credential,
        g_csrf_token: bodyToken,
        state: redirectState,
      })

      expect(response.status).toBe(303)
      expect(response.headers.location).toContain(
        '/login?googleError=GOOGLE_AUTH_INVALID',
      )
      expect(response.headers.location).not.toContain(
        'googleRecovery=',
      )
      expect(
        mocks.consumeGoogleRedirectState,
      ).not.toHaveBeenCalled()
      expect(
        mocks.authenticateWithGoogle,
      ).not.toHaveBeenCalled()
    },
  )

  it('redirects an oversized malformed callback safely without reflecting its body', async () => {
    const oversizedCredential = 'a'.repeat(26_000)
    const response = await request(app)
      .post('/api/auth/google/redirect')
      .set(
        'Content-Type',
        'application/x-www-form-urlencoded',
      )
      .send(`credential=${oversizedCredential}`)

    expect(response.status).toBe(303)
    expect(response.headers.location).toBe(
      '/login?googleError=GOOGLE_AUTH_INVALID',
    )
    expect(response.text).not.toContain(
      oversizedCredential,
    )
    expect(
      mocks.consumeGoogleRedirectState,
    ).not.toHaveBeenCalled()
  })

  it('keeps invalid cross-site callback traffic outside the Google auth rate-limit bucket', async () => {
    for (let index = 0; index < 25; index += 1) {
      const invalidResponse = await request(app)
        .post('/api/auth/google/redirect')
        .type('form')
        .send({
          credential,
          g_csrf_token: 'csrf-token',
          state: redirectState,
        })

      expect(invalidResponse.status).toBe(303)
    }

    mocks.authenticateWithGoogle.mockResolvedValue(
      createAuthentication(),
    )
    const validResponse = await request(app)
      .post('/api/auth/google/redirect')
      .set(
        'Cookie',
        `g_csrf_token=csrf-token; ${bindingCookieName}=${bindingSecret}`,
      )
      .type('form')
      .send({
        credential,
        g_csrf_token: 'csrf-token',
        state: redirectState,
      })

    expect(validResponse.status).toBe(303)
    expect(validResponse.headers.location).toBe(
      redirectContext.returnTo,
    )
  })

  it('preserves safe context after an operational auth error without placing state or credentials in the URL', async () => {
    mocks.authenticateWithGoogle.mockRejectedValue(
      new AppError('Linking required.', {
        statusCode: 409,
        code: 'GOOGLE_ACCOUNT_LINK_REQUIRED',
      }),
    )

    const response = await request(app)
      .post('/api/auth/google/redirect')
      .set(
        'Cookie',
        `g_csrf_token=csrf-token; ${bindingCookieName}=${bindingSecret}`,
      )
      .type('form')
      .send({
        credential,
        g_csrf_token: 'csrf-token',
        state: redirectState,
      })

    expect(response.status).toBe(303)
    expect(response.headers.location).toBe(
      '/register?googleError=GOOGLE_ACCOUNT_LINK_REQUIRED&googleRecovery=1',
    )
    expect(response.headers.location).not.toContain(
      credential,
    )
    expect(response.headers.location).not.toContain(
      'state',
    )
    expect(
      mocks.createGoogleRedirectRecoveryState,
    ).toHaveBeenCalledWith(redirectContext)
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'living_memory_google_recovery=recovery..state.with.parts',
        ),
        expect.stringContaining('HttpOnly'),
        expect.stringContaining('SameSite=Strict'),
      ]),
    )
  })
})
