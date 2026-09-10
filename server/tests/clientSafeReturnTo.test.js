import { describe, expect, it } from 'vitest'
import {
  getSafeReturnTo,
} from '../../client/src/safeReturnTo.js'

describe('Client return destination safety', () => {
  it.each([
    undefined,
    '',
    'https://attacker.example',
    '//attacker.example',
    '/\\attacker.example',
    '%2F%2Fattacker.example',
    '/%2F%2Fattacker.example',
    '/%5Cattacker.example',
    '/%255Cattacker.example',
    '/login?returnTo=https%3A%2F%2Fattacker.example',
    '/login?returnTo=%252F%252Fattacker.example',
    '/login?next=javascript%253Aalert(1)',
    '/api/auth/refresh',
    '/%61pi/auth/refresh',
    'javascript:alert(1)',
    "/safe\u0000unsafe",
    `/${'a'.repeat(2_048)}`,
  ])('falls back for unsafe destination %s', (value) => {
    expect(getSafeReturnTo(value)).toBe('/app')
  })

  it.each([
    '/app',
    '/invitation#token=example',
    '/login?returnTo=%2Fapp',
  ])('preserves an internal destination %s', (value) => {
    const result = getSafeReturnTo(value)

    expect(result).toBe(value)
    expect(
      new URL(
        result,
        'https://zikaron-hai.co.il',
      ).origin,
    ).toBe('https://zikaron-hai.co.il')
  })
})
