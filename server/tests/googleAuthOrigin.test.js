import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  env: {
    googleClientId:
      '123456789-test.apps.googleusercontent.com',
    publicAppUrl: 'https://zikaron-hai.co.il',
  },
}))

vi.mock('../src/config/env.js', () => ({
  env: mocks.env,
}))

import {
  requireGoogleAuthOrigin,
} from '../src/modules/auth/googleAuthOrigin.js'

function runOriginCheck(origin) {
  const request = {
    get: vi.fn().mockReturnValue(origin),
  }
  const next = vi.fn()

  requireGoogleAuthOrigin(
    request,
    {},
    next,
  )

  return next
}

beforeEach(() => {
  mocks.env.googleClientId =
    '123456789-test.apps.googleusercontent.com'
  mocks.env.publicAppUrl =
    'https://zikaron-hai.co.il'
})

describe('Google authentication origin protection', () => {
  it('accepts the configured same origin', () => {
    const next = runOriginCheck(
      'https://zikaron-hai.co.il',
    )

    expect(next).toHaveBeenCalledWith()
  })

  it('accepts the exact Vite localhost origin in development', () => {
    mocks.env.publicAppUrl =
      'http://localhost:5173'

    const next = runOriginCheck(
      'http://localhost:5173',
    )

    expect(next).toHaveBeenCalledWith()
  })

  it.each([
    'https://attacker.example',
    'https://zikaron-hai.co.il.attacker.example',
    'https://zikaron-hai.co.il:444',
    'https://zikaron-hai.co.il/',
    undefined,
    'null',
  ])('rejects unsafe origin %s', (origin) => {
    const next = runOriginCheck(origin)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        code: 'GOOGLE_AUTH_INVALID',
      }),
    )
  })

  it('allows the service to report missing Google configuration', () => {
    mocks.env.googleClientId = ''

    const next = runOriginCheck(undefined)

    expect(next).toHaveBeenCalledWith()
  })

  it('fails safely when Google is enabled without an application URL', () => {
    mocks.env.publicAppUrl = ''

    const next = runOriginCheck(
      'https://zikaron-hai.co.il',
    )

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 503,
        code: 'GOOGLE_AUTH_NOT_CONFIGURED',
      }),
    )
  })
})
