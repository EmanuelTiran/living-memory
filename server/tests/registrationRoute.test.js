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

afterEach(() => {
  vi.resetAllMocks()
})

describe('POST /api/auth/register', () => {
  it('registers a valid user', async () => {
    const publicUser = {
      id: 'user-id',
      displayName: 'Emmanuel Tiran',
      email: 'user@example.com',
      systemRole: 'user',
      status: 'active',
    }

    mocks.registerUser.mockResolvedValue(publicUser)

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        displayName: '  Emmanuel Tiran  ',
        email: '  USER@EXAMPLE.COM  ',
        password: 'a secure passphrase',
      })

    expect(response.status).toBe(201)

    expect(mocks.registerUser).toHaveBeenCalledWith({
      displayName: 'Emmanuel Tiran',
      email: 'user@example.com',
      password: 'a secure passphrase',
    })

    expect(response.body).toEqual({
      success: true,
      data: {
        user: publicUser,
      },
    })

    expect(response.body).not.toHaveProperty(
      'data.user.passwordHash',
    )
  })

  it('returns validation details for invalid input', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        displayName: 'E',
        email: 'invalid-email',
        password: 'short',
      })

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)

    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      requestId: expect.any(String),
    })

    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'displayName',
        }),
        expect.objectContaining({
          field: 'email',
        }),
        expect.objectContaining({
          field: 'password',
        }),
      ]),
    )

    expect(mocks.registerUser).not.toHaveBeenCalled()
  })

  it('returns a conflict for an existing email', async () => {
    mocks.registerUser.mockRejectedValue(
      new AppError(
        'An account with this email already exists.',
        {
          statusCode: 409,
          code: 'EMAIL_ALREADY_REGISTERED',
        },
      ),
    )

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        displayName: 'Emmanuel Tiran',
        email: 'user@example.com',
        password: 'a secure passphrase',
      })

    expect(response.status).toBe(409)

    expect(response.body.error).toMatchObject({
      code: 'EMAIL_ALREADY_REGISTERED',
      message:
        'An account with this email already exists.',
      requestId: expect.any(String),
    })
  })
})