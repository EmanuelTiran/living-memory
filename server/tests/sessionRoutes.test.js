import request from 'supertest'
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { AppError } from '../src/errors/AppError.js'

const mocks = vi.hoisted(() => ({
  refreshAuthentication: vi.fn(),
  logoutUser: vi.fn(),
}))

vi.mock(
  '../src/modules/auth/sessionAuthService.js',
  () => ({
    refreshAuthentication:
      mocks.refreshAuthentication,
    logoutUser: mocks.logoutUser,
  }),
)

import app from '../src/app.js'

const publicUser = {
  id: 'user-id',
  displayName: 'Emmanuel Tiran',
  email: 'user@example.com',
  systemRole: 'user',
  status: 'active',
}

afterEach(() => {
  vi.resetAllMocks()
})

describe('Authentication session routes', () => {
  it('rotates the refresh cookie and returns a new access token', async () => {
    mocks.refreshAuthentication.mockResolvedValue({
      user: publicUser,
      accessToken: 'next-access-token',
      refreshToken: 'next-refresh-token',
      refreshTokenExpiresAt: new Date(
        '2026-08-25T12:00:00.000Z',
      ),
    })

    const response = await request(app)
      .post('/api/auth/refresh')
      .set(
        'Cookie',
        'living_memory_refresh=current-refresh-token',
      )

    expect(response.status).toBe(200)

    expect(
      mocks.refreshAuthentication,
    ).toHaveBeenCalledWith(
      'current-refresh-token',
    )

    expect(response.body).toMatchObject({
      success: true,
      data: {
        user: publicUser,
        accessToken: 'next-access-token',
        accessTokenExpiresInSeconds:
          expect.any(Number),
      },
    })

    expect(response.body).not.toHaveProperty(
      'data.refreshToken',
    )

    const cookies = response.headers['set-cookie']
    const refreshCookie = cookies[0]

    expect(refreshCookie).toContain(
      'living_memory_refresh=next-refresh-token',
    )

    expect(refreshCookie).toContain('HttpOnly')
    expect(refreshCookie).toContain(
      'Path=/api/auth',
    )
    expect(refreshCookie).toContain(
      'SameSite=Strict',
    )
  })

  it('rejects a refresh request without a cookie', async () => {
    mocks.refreshAuthentication.mockRejectedValue(
      new AppError(
        'Refresh token is invalid or expired.',
        {
          statusCode: 401,
          code: 'INVALID_REFRESH_TOKEN',
        },
      ),
    )

    const response = await request(app).post(
      '/api/auth/refresh',
    )

    expect(response.status).toBe(401)

    expect(
      mocks.refreshAuthentication,
    ).toHaveBeenCalledWith(undefined)

    expect(response.body.error).toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
      message:
        'Refresh token is invalid or expired.',
      requestId: expect.any(String),
    })

    expect(
      response.headers['set-cookie'],
    ).toBeUndefined()
  })

  it('revokes the session and clears the cookie', async () => {
    mocks.logoutUser.mockResolvedValue(undefined)

    const response = await request(app)
      .post('/api/auth/logout')
      .set(
        'Cookie',
        'living_memory_refresh=current-refresh-token',
      )

    expect(response.status).toBe(204)

    expect(mocks.logoutUser).toHaveBeenCalledWith(
      'current-refresh-token',
    )

    const cookies = response.headers['set-cookie']
    const clearedCookie = cookies[0]

    expect(clearedCookie).toContain(
      'living_memory_refresh=;',
    )

    expect(clearedCookie).toContain(
      'Path=/api/auth',
    )

    expect(clearedCookie).toContain('HttpOnly')

    expect(clearedCookie).toContain(
      'SameSite=Strict',
    )
  })

  it('allows logout without an existing cookie', async () => {
    mocks.logoutUser.mockResolvedValue(undefined)

    const response = await request(app).post(
      '/api/auth/logout',
    )

    expect(response.status).toBe(204)

    expect(mocks.logoutUser).toHaveBeenCalledWith(
      undefined,
    )

    expect(
      response.headers['set-cookie'],
    ).toBeDefined()
  })
})