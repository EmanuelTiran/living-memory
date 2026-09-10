import {
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  createGoogleRedirectState,
} from './api/authApi.js'
import {
  clearActiveGoogleCredentialHandler,
  GOOGLE_REDIRECT_STATE_REFRESH_MS,
  initializeGoogleIdentity,
  loadGoogleIdentityServices,
  requiresRedirectMode,
  setActiveGoogleCredentialHandler,
  shouldRefreshGoogleRedirectState,
} from './googleIdentityClient.js'

function GoogleIdentityButton({
  clientId,
  invitationToken,
  mode,
  disabled = false,
  onCredential,
  onUnavailable,
  returnTo,
}) {
  const containerRef = useRef(null)
  const [loadState, setLoadState] =
    useState('loading')

  useEffect(() => {
    let isActive = true
    let resizeObserver = null
    let lastRenderedWidth = 0
    let redirectConfiguration = null
    let redirectStateCreatedAt = 0
    let redirectRefreshPromise = null
    let redirectRefreshTimeout = null
    let api = null
    const redirectMode = requiresRedirectMode()

    function handleCredential(credential) {
      if (!isActive) {
        return
      }

      if (
        typeof credential !== 'string' ||
        credential.length === 0
      ) {
        onUnavailable()
        return
      }

      onCredential(credential)
    }

    setActiveGoogleCredentialHandler(
      handleCredential,
    )

    function renderButton() {
      const container = containerRef.current

      if (
        !container ||
        !api ||
        (redirectMode && !redirectConfiguration)
      ) {
        return
      }

      const availableWidth = Math.floor(
        container.getBoundingClientRect().width,
      )
      const width = Math.min(
        400,
        Math.max(200, availableWidth),
      )

      if (width === lastRenderedWidth) {
        return
      }

      lastRenderedWidth = width
      container.replaceChildren()

      const buttonConfiguration = {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text:
          mode === 'register'
            ? 'continue_with'
            : 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width,
        locale: 'he',
      }

      if (redirectConfiguration?.state) {
        buttonConfiguration.state =
          redirectConfiguration.state
      }

      api.renderButton(
        container,
        buttonConfiguration,
      )
    }

    function scheduleRedirectStateRefresh() {
      clearTimeout(redirectRefreshTimeout)

      if (!redirectMode || !isActive) {
        return
      }

      redirectRefreshTimeout = setTimeout(
        () => {
          refreshRedirectState(true)
        },
        GOOGLE_REDIRECT_STATE_REFRESH_MS,
      )
    }

    function refreshRedirectState(force = false) {
      if (
        !redirectMode ||
        !isActive ||
        (!force &&
          !shouldRefreshGoogleRedirectState(
            redirectStateCreatedAt,
          ))
      ) {
        return Promise.resolve()
      }

      if (redirectRefreshPromise) {
        return redirectRefreshPromise
      }

      clearTimeout(redirectRefreshTimeout)
      redirectConfiguration = null
      containerRef.current?.replaceChildren()
      setLoadState('loading')

      redirectRefreshPromise =
        createGoogleRedirectState({
          mode,
          returnTo,
          invitationToken:
            invitationToken || undefined,
        })
          .then((configuration) => {
            if (
              !isActive ||
              !containerRef.current
            ) {
              return
            }

            redirectConfiguration = configuration
            redirectStateCreatedAt = Date.now()
            initializeGoogleIdentity(api, {
              clientId,
              loginUri: configuration.loginUri,
              redirectMode: true,
            })
            lastRenderedWidth = 0
            renderButton()
            setLoadState('ready')
            scheduleRedirectStateRefresh()
          })
          .catch(() => {
            if (isActive) {
              setLoadState('error')
              onUnavailable()
            }
          })
          .finally(() => {
            redirectRefreshPromise = null
          })

      return redirectRefreshPromise
    }

    function refreshStaleRedirectState() {
      if (
        document.visibilityState === 'visible' &&
        shouldRefreshGoogleRedirectState(
          redirectStateCreatedAt,
        )
      ) {
        refreshRedirectState(true)
      }
    }

    loadGoogleIdentityServices()
      .then((loadedApi) => {
        if (!isActive || !containerRef.current) {
          return
        }

        api = loadedApi

        if (redirectMode) {
          refreshRedirectState(true)
        } else {
          initializeGoogleIdentity(api, {
            clientId,
            loginUri: '',
            redirectMode: false,
          })
          renderButton()
          setLoadState('ready')
        }

        if ('ResizeObserver' in window) {
          resizeObserver = new ResizeObserver(
            renderButton,
          )
          resizeObserver.observe(
            containerRef.current,
          )
        } else {
          window.addEventListener(
            'resize',
            renderButton,
          )
          resizeObserver = {
            disconnect() {
              window.removeEventListener(
                'resize',
                renderButton,
              )
            },
          }
        }

        if (redirectMode) {
          document.addEventListener(
            'visibilitychange',
            refreshStaleRedirectState,
          )
          window.addEventListener(
            'focus',
            refreshStaleRedirectState,
          )
        }
      })
      .catch(() => {
        if (isActive) {
          setLoadState('error')
          onUnavailable()
        }
      })

    return () => {
      isActive = false
      clearTimeout(redirectRefreshTimeout)
      resizeObserver?.disconnect()
      document.removeEventListener(
        'visibilitychange',
        refreshStaleRedirectState,
      )
      window.removeEventListener(
        'focus',
        refreshStaleRedirectState,
      )

      clearActiveGoogleCredentialHandler(
        handleCredential,
      )
    }
  }, [
    clientId,
    invitationToken,
    mode,
    onCredential,
    onUnavailable,
    returnTo,
  ])

  return (
    <div
      className={`auth-google-button ${
        disabled ? 'is-disabled' : ''
      }`}
      aria-label={
        mode === 'register'
          ? 'המשך להרשמה באמצעות Google'
          : 'כניסה באמצעות Google'
      }
      aria-busy={loadState === 'loading'}
      aria-disabled={disabled}
      inert={disabled}
      ref={containerRef}
      role="group"
    />
  )
}

export default GoogleIdentityButton
