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
  registerUser: vi.fn(),
  loginUser: vi.fn(),
}))

vi.mock('../src/modules/auth/authService.js', () => ({
  registerUser: mocks.registerUser,
  loginUser: mocks.loginUser,
}))

import app from '../src/app.js'

const validLogin = {
  email: '  USER@EXAMPLE.COM  ',
  password: 'existing-password',
}

afterEach(() => {
  vi.resetAllMocks()
})

describe('POST /api/auth/login', () => {
  it('logs in and sets a secure refresh cookie', async () => {
    const publicUser = {
      id: 'user-id',
      displayName: 'Emmanuel Tiran',
      email: 'user@example.com',
      systemRole: 'user',
      status: 'active',
    }

    mocks.loginUser.mockResolvedValue({
      user: publicUser,
      accessToken: 'signed-access-token',
      refreshToken: 'raw-refresh-token',
      refreshTokenExpiresAt: new Date(
        '2026-08-25T12:00:00.000Z',
      ),
    })

    const response = await request(app)
      .post('/api/auth/login')
      .send(validLogin)

    expect(response.status).toBe(200)

    expect(mocks.loginUser).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'existing-password',
    })

    expect(response.body).toMatchObject({
      success: true,
      data: {
        user: publicUser,
        accessToken: 'signed-access-token',
        accessTokenExpiresInSeconds:
          expect.any(Number),
      },
    })

    expect(response.body).not.toHaveProperty(
      'data.refreshToken',
    )

    const cookies = response.headers['set-cookie']

    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'living_memory_refresh=raw-refresh-token',
        ),
      ]),
    )

    const refreshCookie = cookies[0]

    expect(refreshCookie).toContain('HttpOnly')
    expect(refreshCookie).toContain(
      'Path=/api/auth',
    )
    expect(refreshCookie).toContain(
      'SameSite=Strict',
    )
  })

  it('rejects invalid login input', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'invalid-email',
        password: '',
      })

    expect(response.status).toBe(400)

    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      requestId: expect.any(String),
    })

    expect(mocks.loginUser).not.toHaveBeenCalled()
  })

  it('returns a safe invalid-credentials response', async () => {
    mocks.loginUser.mockRejectedValue(
      new AppError(
        'Email or password is incorrect.',
        {
          statusCode: 401,
          code: 'INVALID_CREDENTIALS',
        },
      ),
    )

    const response = await request(app)
      .post('/api/auth/login')
      .send(validLogin)

    expect(response.status).toBe(401)

    expect(response.body.error).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Email or password is incorrect.',
      requestId: expect.any(String),
    })

    expect(
      response.headers['set-cookie'],
    ).toBeUndefined()
  })
})