import {
  hkdfSync,
  randomBytes,
} from 'node:crypto'
import { jwtDecrypt } from 'jose'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  env: {
    accessTokenSecret: 's'.repeat(64),
    googleClientId:
      '123456789-test.apps.googleusercontent.com',
    publicAppUrl: 'https://zikaron-hai.co.il',
  },
}))

vi.mock('../src/config/env.js', () => ({
  env: mocks.env,
}))

vi.mock(
  '../src/modules/auth/GoogleRedirectAttempt.js',
  () => ({
    default: {
      create: vi.fn(),
      findOneAndDelete: vi.fn(),
    },
  }),
)

import {
  consumeGoogleRedirectRecoveryState,
  consumeGoogleRedirectState,
  createGoogleRedirectBindingCookieOptions,
  createGoogleRedirectRecoveryCookieOptions,
  createGoogleRedirectState,
  createGoogleRedirectRecoveryState,
  getGoogleRedirectLoginUri,
} from '../src/modules/auth/googleRedirectStateService.js'

const context = {
  mode: 'register',
  returnTo: '/invitation?token=public-link-token',
  invitationToken: 'i'.repeat(43),
}
const currentDate = new Date(
  '2026-09-08T12:00:00.000Z',
)
const key = randomBytes(32)

function createMemoryStateStore() {
  const records = new Map()

  return {
    records,
    create: vi.fn(async (record) => {
      if (records.has(record.stateIdHash)) {
        throw Object.assign(
          new Error('Duplicate state'),
          {
            code: 11000,
          },
        )
      }

      records.set(record.stateIdHash, record)
      return record
    }),
    consume: vi.fn(async (filter) => {
      const record = records.get(
        filter.stateIdHash,
      )

      if (
        !record ||
        record.expiresAt <= filter.expiresAt.$gt
      ) {
        return null
      }

      records.delete(filter.stateIdHash)
      return record
    }),
  }
}

function getBindingCookies(configuration) {
  return {
    [configuration.bindingCookieName]:
      configuration.bindingSecret,
  }
}

function expectInvalidGoogleState(promise) {
  return expect(promise).rejects.toMatchObject({
    statusCode: 401,
    code: 'GOOGLE_AUTH_INVALID',
  })
}

beforeEach(() => {
  mocks.env.googleClientId =
    '123456789-test.apps.googleusercontent.com'
  mocks.env.publicAppUrl =
    'https://zikaron-hai.co.il'
})

describe('Google redirect state service', () => {
  it('uses narrowly scoped secure cookies for cross-site callback binding and same-site recovery', () => {
    expect(
      createGoogleRedirectBindingCookieOptions(
        currentDate,
      ),
    ).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/api/auth/google/redirect',
      expires: currentDate,
    })
    expect(
      createGoogleRedirectRecoveryCookieOptions(
        currentDate,
      ),
    ).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/api/auth/google/redirect-state/resolve',
      expires: currentDate,
    })
  })

  it('round-trips encrypted browser-bound auth context exactly once', async () => {
    const stateStore = createMemoryStateStore()
    const configuration =
      await createGoogleRedirectState(context, {
        key,
        currentDate,
        stateStore,
      })

    expect(configuration.state.split('.')).toHaveLength(
      5,
    )
    expect(configuration.state).not.toContain(
      context.invitationToken,
    )
    expect(configuration.state).not.toContain(
      context.returnTo,
    )
    expect(configuration.bindingSecret).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    )
    expect(configuration.expiresAt).toEqual(
      new Date('2026-09-08T12:10:00.000Z'),
    )

    const first = await consumeGoogleRedirectState(
      configuration.state,
      getBindingCookies(configuration),
      {
        key,
        currentDate: new Date(
          '2026-09-08T12:05:00.000Z',
        ),
        stateStore,
      },
    )

    expect(first).toEqual({
      context,
      bindingCookieName:
        configuration.bindingCookieName,
    })

    await expectInvalidGoogleState(
      consumeGoogleRedirectState(
        configuration.state,
        getBindingCookies(configuration),
        {
          key,
          currentDate: new Date(
            '2026-09-08T12:05:00.000Z',
          ),
          stateStore,
        },
      ),
    )
  })

  it('rejects a stolen state without consuming the rightful browser attempt', async () => {
    const stateStore = createMemoryStateStore()
    const configuration =
      await createGoogleRedirectState(context, {
        key,
        currentDate,
        stateStore,
      })

    await expectInvalidGoogleState(
      consumeGoogleRedirectState(
        configuration.state,
        {},
        {
          key,
          currentDate,
          stateStore,
        },
      ),
    )
    expect(stateStore.records.size).toBe(1)

    await expect(
      consumeGoogleRedirectState(
        configuration.state,
        getBindingCookies(configuration),
        {
          key,
          currentDate,
          stateStore,
        },
      ),
    ).resolves.toMatchObject({ context })
  })

  it('rejects a mismatched browser-binding secret', async () => {
    const stateStore = createMemoryStateStore()
    const configuration =
      await createGoogleRedirectState(context, {
        key,
        currentDate,
        stateStore,
      })

    await expectInvalidGoogleState(
      consumeGoogleRedirectState(
        configuration.state,
        {
          [configuration.bindingCookieName]:
            'a'.repeat(43),
        },
        {
          key,
          currentDate,
          stateStore,
        },
      ),
    )
  })

  it('round-trips an HttpOnly recovery state once and rejects it as an auth state', async () => {
    const stateStore = createMemoryStateStore()
    const recovery =
      await createGoogleRedirectRecoveryState(
        context,
        {
          key,
          currentDate,
          stateStore,
        },
      )

    expect(recovery).not.toHaveProperty(
      'bindingSecret',
    )
    await expectInvalidGoogleState(
      consumeGoogleRedirectState(
        recovery.state,
        {},
        {
          key,
          currentDate,
          stateStore,
        },
      ),
    )
    expect(stateStore.records.size).toBe(1)

    await expect(
      consumeGoogleRedirectRecoveryState(
        recovery.state,
        {
          key,
          currentDate,
          stateStore,
        },
      ),
    ).resolves.toEqual(context)
    await expectInvalidGoogleState(
      consumeGoogleRedirectRecoveryState(
        recovery.state,
        {
          key,
          currentDate,
          stateStore,
        },
      ),
    )
  })

  it('keeps the largest allowed recovery context within browser cookie limits', async () => {
    const recovery =
      await createGoogleRedirectRecoveryState(
        {
          ...context,
          returnTo: `/${'a'.repeat(2_047)}`,
        },
        {
          key,
          currentDate,
          stateStore: createMemoryStateStore(),
        },
      )

    expect(recovery.state.length).toBeLessThan(3_800)
  })

  it('uses a purpose-separated default encryption key', async () => {
    const stateStore = createMemoryStateStore()
    const configuration =
      await createGoogleRedirectState(context, {
        currentDate,
        stateStore,
      })
    const otherPurposeKey = Buffer.from(
      hkdfSync(
        'sha256',
        mocks.env.accessTokenSecret,
        'living-memory-auth-key-derivation-v1',
        'different-auth-purpose-v1',
        32,
      ),
    )

    await expect(
      jwtDecrypt(
        configuration.state,
        otherPurposeKey,
      ),
    ).rejects.toBeDefined()
    await expect(
      consumeGoogleRedirectState(
        configuration.state,
        getBindingCookies(configuration),
        {
          currentDate,
          stateStore,
        },
      ),
    ).resolves.toMatchObject({ context })
  })

  it('rejects an expired redirect state', async () => {
    const stateStore = createMemoryStateStore()
    const configuration =
      await createGoogleRedirectState(context, {
        key,
        currentDate,
        stateStore,
      })

    await expectInvalidGoogleState(
      consumeGoogleRedirectState(
        configuration.state,
        getBindingCookies(configuration),
        {
          key,
          currentDate: new Date(
            '2026-09-08T12:11:00.000Z',
          ),
          stateStore,
        },
      ),
    )
  })

  it('rejects tampering without consuming the stored attempt', async () => {
    const stateStore = createMemoryStateStore()
    const configuration =
      await createGoogleRedirectState(context, {
        key,
        currentDate,
        stateStore,
      })
    const stateParts = configuration.state.split('.')
    const ciphertext = stateParts[3]
    const replacement =
      ciphertext[0] === 'a' ? 'b' : 'a'
    stateParts[3] =
      `${replacement}${ciphertext.slice(1)}`
    const tamperedState = stateParts.join('.')

    await expectInvalidGoogleState(
      consumeGoogleRedirectState(
        tamperedState,
        getBindingCookies(configuration),
        {
          key,
          currentDate,
          stateStore,
        },
      ),
    )
    expect(stateStore.records.size).toBe(1)
  })

  it.each([
    'https://attacker.example',
    '//attacker.example',
    '/safe\\unsafe',
    '%2F%2Fattacker.example',
    '/%2F%2Fattacker.example',
    '/%255Cattacker.example',
    '/login?returnTo=https%3A%2F%2Fattacker.example',
    '/login?returnTo=%252F%252Fattacker.example',
    '/api/auth/refresh',
    '/%61pi/auth/refresh',
    'javascript:alert(1)',
    "/safe\u0000unsafe",
  ])('rejects unsafe return destination %s', async (returnTo) => {
    await expect(
      createGoogleRedirectState(
        {
          ...context,
          returnTo,
        },
        {
          key,
          currentDate,
          stateStore: createMemoryStateStore(),
        },
      ),
    ).rejects.toMatchObject({
      name: 'ZodError',
    })
  })

  it.each([
    '/app',
    '/invitation#token=example',
    '/login?returnTo=%2Fapp',
  ])('keeps a safe internal destination: %s', async (returnTo) => {
    const stateStore = createMemoryStateStore()
    const configuration =
      await createGoogleRedirectState(
        {
          ...context,
          returnTo,
        },
        {
          key,
          currentDate,
          stateStore,
        },
      )
    const restored = await consumeGoogleRedirectState(
      configuration.state,
      getBindingCookies(configuration),
      {
        key,
        currentDate,
        stateStore,
      },
    )

    expect(restored.context.returnTo).toBe(returnTo)
  })

  it('builds the exact configured production redirect URI', () => {
    expect(getGoogleRedirectLoginUri()).toBe(
      'https://zikaron-hai.co.il/api/auth/google/redirect',
    )
  })

  it('builds the exact localhost redirect URI served through Vite', () => {
    mocks.env.publicAppUrl =
      'http://localhost:5173'

    expect(getGoogleRedirectLoginUri()).toBe(
      'http://localhost:5173/api/auth/google/redirect',
    )
  })

  it('rejects an insecure non-local development redirect origin', () => {
    mocks.env.publicAppUrl =
      'http://192.0.2.10:5173'

    expect(() =>
      getGoogleRedirectLoginUri(),
    ).toThrowError(
      expect.objectContaining({
        statusCode: 503,
        code: 'GOOGLE_AUTH_NOT_CONFIGURED',
      }),
    )
  })

  it('fails safely when Google is not configured', async () => {
    mocks.env.googleClientId = ''

    await expect(
      createGoogleRedirectState(context, {
        key,
        currentDate,
        stateStore: createMemoryStateStore(),
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'GOOGLE_AUTH_NOT_CONFIGURED',
    })
  })
})
