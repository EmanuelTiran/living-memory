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
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}))

vi.mock(
  '../src/modules/auth/passwordResetService.js',
  () => ({
    requestPasswordReset:
      mocks.requestPasswordReset,
    resetPassword: mocks.resetPassword,
  }),
)

import app from '../src/app.js'

const validToken = 'A'.repeat(43)
const validPassword =
  'a new secure passphrase'

afterEach(() => {
  vi.resetAllMocks()
})

describe('Password reset routes', () => {
  it('accepts a normalized forgot-password request generically', async () => {
    mocks.requestPasswordReset.mockResolvedValue()

    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({
        email: '  USER@EXAMPLE.COM  ',
      })

    expect(response.status).toBe(202)
    expect(response.body).toEqual({
      success: true,
      data: {
        accepted: true,
      },
    })
    expect(
      mocks.requestPasswordReset,
    ).toHaveBeenCalledWith({
      email: 'user@example.com',
    })
  })

  it.each([
    'unknown-route@example.com',
    'suspended-route@example.com',
  ])(
    'uses the same public response for %s',
    async (email) => {
      mocks.requestPasswordReset.mockResolvedValue()

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email })

      expect(response.status).toBe(202)
      expect(response.body).toEqual({
        success: true,
        data: {
          accepted: true,
        },
      })
    },
  )

  it('rejects invalid forgot-password input', async () => {
    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'not-an-email' })

    expect(response.status).toBe(400)
    expect(
      mocks.requestPasswordReset,
    ).not.toHaveBeenCalled()
  })

  it('rate-limits repeated requests for one email', async () => {
    mocks.requestPasswordReset.mockResolvedValue()
    const email = 'rate-limit@example.com'

    const responses = []

    for (let index = 0; index < 4; index += 1) {
      responses.push(
        await request(app)
          .post('/api/auth/forgot-password')
          .send({ email }),
      )
    }

    expect(
      responses.slice(0, 3).map(
        (response) => response.status,
      ),
    ).toEqual([202, 202, 202])
    expect(responses[3].status).toBe(429)
    expect(responses[3].body.error.code).toBe(
      'AUTH_RATE_LIMITED',
    )
    expect(
      mocks.requestPasswordReset,
    ).toHaveBeenCalledTimes(3)
  })

  it('resets a password with valid input', async () => {
    mocks.resetPassword.mockResolvedValue()

    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: validToken,
        password: validPassword,
      })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      success: true,
      data: {
        reset: true,
      },
    })
    expect(mocks.resetPassword).toHaveBeenCalledWith({
      token: validToken,
      password: validPassword,
    })
  })

  it.each([
    {
      token: 'invalid',
      password: validPassword,
    },
    {
      token: validToken,
      password: 'too-short',
    },
  ])('rejects invalid reset input', async (body) => {
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send(body)

    expect(response.status).toBe(400)
    expect(mocks.resetPassword).not.toHaveBeenCalled()
  })

  it('returns one generic invalid-token error', async () => {
    mocks.resetPassword.mockRejectedValue(
      new AppError(
        'Password reset link is invalid or expired.',
        {
          statusCode: 400,
          code: 'PASSWORD_RESET_INVALID_OR_EXPIRED',
        },
      ),
    )

    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: validToken,
        password: validPassword,
      })

    expect(response.status).toBe(400)
    expect(response.body.error).toMatchObject({
      code: 'PASSWORD_RESET_INVALID_OR_EXPIRED',
      message:
        'Password reset link is invalid or expired.',
    })
  })
})
