import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('Google Identity Services client lifecycle', () => {
  it('loads the official GIS script only once across concurrent mounts', async () => {
    const listeners = new Map()
    const script = {
      dataset: {},
      isConnected: false,
      addEventListener: vi.fn(
        (name, listener) => {
          listeners.set(name, listener)
        },
      ),
      removeEventListener: vi.fn(),
      remove: vi.fn(),
    }
    const api = {
      initialize: vi.fn(),
      renderButton: vi.fn(),
    }
    const head = {
      append: vi.fn((node) => {
        node.isConnected = true
      }),
    }

    vi.stubGlobal('window', {
      google: undefined,
    })
    vi.stubGlobal('document', {
      querySelector: vi.fn().mockReturnValue(null),
      createElement: vi.fn().mockReturnValue(script),
      head,
    })

    const {
      loadGoogleIdentityServices,
    } = await import(
      '../../client/src/googleIdentityClient.js'
    )
    const first = loadGoogleIdentityServices()
    const second = loadGoogleIdentityServices()

    expect(first).toBe(second)
    expect(head.append).toHaveBeenCalledOnce()
    expect(script.src).toBe(
      'https://accounts.google.com/gsi/client?hl=he',
    )

    globalThis.window.google = {
      accounts: {
        id: api,
      },
    }
    listeners.get('load')()

    await expect(first).resolves.toBe(api)
    await expect(second).resolves.toBe(api)
    expect(script.remove).not.toHaveBeenCalled()
  })

  it('initializes GIS only once for an unchanged popup configuration', async () => {
    vi.stubGlobal('window', {
      navigator: {},
    })
    const api = {
      initialize: vi.fn(),
    }
    const configuration = {
      clientId:
        '123456789-test.apps.googleusercontent.com',
      loginUri: '',
      redirectMode: false,
    }
    const {
      clearActiveGoogleCredentialHandler,
      initializeGoogleIdentity,
      setActiveGoogleCredentialHandler,
    } = await import(
      '../../client/src/googleIdentityClient.js'
    )
    const firstHandler = vi.fn()
    const remountedHandler = vi.fn()

    setActiveGoogleCredentialHandler(firstHandler)
    initializeGoogleIdentity(api, configuration)
    initializeGoogleIdentity(api, configuration)

    expect(api.initialize).toHaveBeenCalledOnce()
    expect(api.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: configuration.clientId,
        ux_mode: 'popup',
        use_fedcm_for_button: true,
        button_auto_select: false,
        callback: expect.any(Function),
      }),
    )

    const callback =
      api.initialize.mock.calls[0][0].callback

    clearActiveGoogleCredentialHandler(firstHandler)
    callback({ credential: 'ignored-after-unmount' })
    expect(firstHandler).not.toHaveBeenCalled()

    setActiveGoogleCredentialHandler(
      remountedHandler,
    )
    callback({ credential: 'current-credential' })
    expect(remountedHandler).toHaveBeenCalledWith(
      'current-credential',
    )
  })

  it('fails a stalled GIS script safely and permits a later retry', async () => {
    vi.useFakeTimers()
    const scripts = []

    function createScript() {
      const listeners = new Map()
      const script = {
        dataset: {},
        isConnected: false,
        listeners,
        addEventListener(name, listener) {
          listeners.set(name, listener)
        },
        removeEventListener: vi.fn(),
        remove: vi.fn(),
      }

      scripts.push(script)
      return script
    }

    vi.stubGlobal('window', {
      google: undefined,
    })
    vi.stubGlobal('document', {
      querySelector: vi.fn().mockReturnValue(null),
      createElement: vi
        .fn()
        .mockImplementation(createScript),
      head: {
        append(node) {
          node.isConnected = true
        },
      },
    })

    const {
      loadGoogleIdentityServices,
    } = await import(
      '../../client/src/googleIdentityClient.js'
    )
    const firstAttempt =
      loadGoogleIdentityServices()
    const expectedFailure = expect(
      firstAttempt,
    ).rejects.toThrow(
      'Google Identity Services could not be loaded.',
    )

    await vi.advanceTimersByTimeAsync(15_000)
    await expectedFailure
    expect(scripts[0].remove).toHaveBeenCalledOnce()

    const retryAttempt =
      loadGoogleIdentityServices()

    expect(scripts).toHaveLength(2)
    retryAttempt.catch(() => {})
  })

  it.each([
    {
      navigatorObject: {
        userAgent: 'Mozilla/5.0 (iPhone)',
        platform: 'iPhone',
        maxTouchPoints: 5,
      },
      expected: true,
    },
    {
      navigatorObject: {
        userAgent: 'Mozilla/5.0 (Macintosh)',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      },
      expected: true,
    },
    {
      navigatorObject: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0)',
        platform: 'Win32',
        maxTouchPoints: 0,
      },
      expected: false,
    },
  ])('selects redirect mode only for iOS-class devices', async ({ navigatorObject, expected }) => {
    vi.stubGlobal('window', {
      navigator: navigatorObject,
    })
    const {
      requiresRedirectMode,
    } = await import(
      '../../client/src/googleIdentityClient.js'
    )

    expect(
      requiresRedirectMode(navigatorObject),
    ).toBe(expected)
  })

  it('refreshes redirect state before its ten-minute server expiry', async () => {
    vi.stubGlobal('window', {
      navigator: {},
    })
    const {
      shouldRefreshGoogleRedirectState,
    } = await import(
      '../../client/src/googleIdentityClient.js'
    )
    const createdAt = Date.now()

    expect(
      shouldRefreshGoogleRedirectState(
        createdAt,
        createdAt + 4 * 60 * 1000,
      ),
    ).toBe(false)
    expect(
      shouldRefreshGoogleRedirectState(
        createdAt,
        createdAt + 5 * 60 * 1000,
      ),
    ).toBe(true)
  })
})
