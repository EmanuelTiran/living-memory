import { describe, expect, it } from 'vitest'
import {
  getConfiguredGoogleClientId,
} from '../../client/src/googleClientConfiguration.js'

describe('Client Google configuration', () => {
  it('accepts and trims a valid Web client ID', () => {
    expect(
      getConfiguredGoogleClientId(
        ' 123456789-test.apps.googleusercontent.com ',
      ),
    ).toBe(
      '123456789-test.apps.googleusercontent.com',
    )
  })

  it.each([
    undefined,
    '',
    'not-a-client-id',
    'https://accounts.google.com',
    `${'a'.repeat(256)}.apps.googleusercontent.com`,
  ])('disables Google UI for unsafe value %s', (value) => {
    expect(getConfiguredGoogleClientId(value)).toBe('')
  })
})
