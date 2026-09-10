import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import {
  normalizeGoogleClientId,
} from '../src/config/env.js'

describe('Server Google configuration', () => {
  it('accepts and trims a valid Web client ID', () => {
    expect(
      normalizeGoogleClientId(
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
  ])('safely disables Google for malformed value %s', (value) => {
    expect(normalizeGoogleClientId(value)).toBe('')
  })

  it('does not prevent password authentication startup when the optional Google ID is malformed', () => {
    const envModuleUrl = new URL(
      '../src/config/env.js',
      import.meta.url,
    ).href
    const probe = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        'const { env } = await import(process.argv[1]); if (env.googleClientId !== "") process.exit(2)',
        envModuleUrl,
      ],
      {
        env: {
          ...process.env,
          NODE_ENV: 'test',
          MONGODB_URI:
            'mongodb://127.0.0.1:27017/living-memory-test',
          ACCESS_TOKEN_SECRET: 's'.repeat(64),
          GOOGLE_CLIENT_ID: 'malformed-client-id',
          PERSISTENT_STORAGE_REQUIRED: 'false',
        },
        encoding: 'utf8',
      },
    )

    expect(probe.status).toBe(0)
    expect(probe.stderr).toBe('')
  })
})
