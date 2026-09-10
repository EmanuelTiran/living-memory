const GOOGLE_IDENTITY_SCRIPT_URL =
  'https://accounts.google.com/gsi/client?hl=he'
const GOOGLE_IDENTITY_SCRIPT_SELECTOR =
  'script[data-living-memory-google-identity]'
const GOOGLE_IDENTITY_SCRIPT_TIMEOUT_MS = 15_000

export const GOOGLE_REDIRECT_STATE_REFRESH_MS =
  5 * 60 * 1000

let googleIdentityScriptPromise = null
let initializationKey = ''
let activeCredentialHandler = null

function getGoogleIdentityApi() {
  return window.google?.accounts?.id ?? null
}

export function setActiveGoogleCredentialHandler(
  handler,
) {
  activeCredentialHandler = handler
}

export function clearActiveGoogleCredentialHandler(
  handler,
) {
  if (activeCredentialHandler === handler) {
    activeCredentialHandler = null
  }
}

export function loadGoogleIdentityServices() {
  const existingApi = getGoogleIdentityApi()

  if (existingApi) {
    return Promise.resolve(existingApi)
  }

  if (googleIdentityScriptPromise) {
    return googleIdentityScriptPromise
  }

  googleIdentityScriptPromise = new Promise(
    (resolve, reject) => {
      let script = document.querySelector(
        GOOGLE_IDENTITY_SCRIPT_SELECTOR,
      )
      let timeoutId

      function cleanup() {
        clearTimeout(timeoutId)
        script?.removeEventListener(
          'load',
          handleLoad,
        )
        script?.removeEventListener(
          'error',
          handleError,
        )
      }

      function handleLoad() {
        cleanup()
        const api = getGoogleIdentityApi()

        if (!api) {
          googleIdentityScriptPromise = null
          script?.remove()
          reject(
            new Error(
              'Google Identity Services did not initialize.',
            ),
          )
          return
        }

        resolve(api)
      }

      function handleError() {
        cleanup()
        googleIdentityScriptPromise = null
        script?.remove()
        reject(
          new Error(
            'Google Identity Services could not be loaded.',
          ),
        )
      }

      if (!script) {
        script = document.createElement('script')
        script.src = GOOGLE_IDENTITY_SCRIPT_URL
        script.async = true
        script.dataset.livingMemoryGoogleIdentity =
          'true'
      }

      script.addEventListener('load', handleLoad, {
        once: true,
      })
      script.addEventListener('error', handleError, {
        once: true,
      })
      timeoutId = setTimeout(
        handleError,
        GOOGLE_IDENTITY_SCRIPT_TIMEOUT_MS,
      )

      if (!script.isConnected) {
        document.head.append(script)
      }
    },
  )

  return googleIdentityScriptPromise
}

export function requiresRedirectMode(
  navigatorObject = window.navigator,
) {
  return (
    /iPad|iPhone|iPod/.test(
      navigatorObject.userAgent,
    ) ||
    (navigatorObject.platform === 'MacIntel' &&
      navigatorObject.maxTouchPoints > 1)
  )
}

export function initializeGoogleIdentity(
  api,
  {
    clientId,
    loginUri,
    redirectMode,
  },
) {
  const nextInitializationKey = [
    clientId,
    redirectMode ? 'redirect' : 'popup',
    loginUri,
  ].join('|')

  if (initializationKey === nextInitializationKey) {
    return
  }

  const configuration = {
    client_id: clientId,
    ux_mode: redirectMode
      ? 'redirect'
      : 'popup',
    use_fedcm_for_button: true,
    button_auto_select: false,
  }

  if (redirectMode) {
    configuration.login_uri = loginUri
  } else {
    configuration.callback = (response) => {
      activeCredentialHandler?.(
        response?.credential,
      )
    }
  }

  api.initialize(configuration)
  initializationKey = nextInitializationKey
}

export function shouldRefreshGoogleRedirectState(
  createdAt,
  currentTime = Date.now(),
) {
  return (
    !Number.isFinite(createdAt) ||
    currentTime - createdAt >=
      GOOGLE_REDIRECT_STATE_REFRESH_MS
  )
}
