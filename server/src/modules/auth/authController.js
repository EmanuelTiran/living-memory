import { env } from '../../config/env.js'
import {
  createClearRefreshCookieOptions,
  createRefreshCookieOptions,
  refreshCookieName,
} from './authCookies.js'
import {
  loginUser,
  registerUser,
} from './authService.js'
import { getCurrentUser } from './currentUserService.js'
import {
  logoutUser,
  refreshAuthentication,
} from './sessionAuthService.js'
import {
  requestPasswordReset,
  resetPassword as resetUserPassword,
} from './passwordResetService.js'
import {
  authenticateWithGoogle,
} from './googleAuthService.js'
import {
  consumeGoogleRedirectRecoveryState,
  consumeGoogleRedirectState,
  createClearGoogleRedirectBindingCookieOptions,
  createClearGoogleRedirectRecoveryCookieOptions,
  createGoogleRedirectBindingCookieOptions,
  createGoogleRedirectRecoveryCookieOptions,
  createGoogleRedirectRecoveryState,
  createGoogleRedirectState,
  getGoogleRedirectLoginUri,
  googleRedirectRecoveryCookieName,
} from './googleRedirectStateService.js'

const googleRedirectErrorCodes = new Set([
  'ACCOUNT_SUSPENDED',
  'AUTH_RATE_LIMITED',
  'GOOGLE_ACCOUNT_LINK_REQUIRED',
  'GOOGLE_AUTH_INVALID',
  'GOOGLE_AUTH_NOT_CONFIGURED',
  'GOOGLE_REGISTRATION_UNAVAILABLE',
  'REGISTRATION_INVITATION_INVALID',
  'REGISTRATION_INVITATION_REQUIRED',
  'VALIDATION_ERROR',
])
const googleRedirectRequestErrorTypes = new Set([
  'entity.parse.failed',
  'entity.too.large',
])

function setAuthenticationCookie(
  res,
  {
    refreshToken,
    refreshTokenExpiresAt,
  },
) {
  res.cookie(
    refreshCookieName,
    refreshToken,
    createRefreshCookieOptions(
      refreshTokenExpiresAt,
    ),
  )
}

function sendAuthenticationResponse(
  res,
  {
    user,
    accessToken,
    refreshToken,
    refreshTokenExpiresAt,
  },
) {
  setAuthenticationCookie(res, {
    refreshToken,
    refreshTokenExpiresAt,
  })

  res.status(200).json({
    success: true,
    data: {
      user,
      accessToken,
      accessTokenExpiresInSeconds:
        env.accessTokenTtlMinutes * 60,
    },
  })
}

export async function register(req, res) {
  const user = await registerUser(req.validatedBody)

  res.status(201).json({
    success: true,
    data: {
      user,
    },
  })
}

export async function login(req, res) {
  const authentication = await loginUser(
    req.validatedBody,
  )

  sendAuthenticationResponse(
    res,
    authentication,
  )
}

export async function googleLogin(req, res) {
  const authentication =
    await authenticateWithGoogle(
      req.validatedBody,
    )

  sendAuthenticationResponse(
    res,
    authentication,
  )
}

export async function createGoogleRedirect(
  req,
  res,
) {
  const {
    state,
    expiresAt,
    bindingCookieName,
    bindingSecret,
  } = await createGoogleRedirectState(
    req.validatedBody,
  )

  res.cookie(
    bindingCookieName,
    bindingSecret,
    createGoogleRedirectBindingCookieOptions(
      expiresAt,
    ),
  )

  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    success: true,
    data: {
      state,
      loginUri: getGoogleRedirectLoginUri(),
    },
  })
}

export async function resolveGoogleRedirect(
  req,
  res,
) {
  const recoveryState =
    req.cookies?.[
      googleRedirectRecoveryCookieName
    ]

  res.clearCookie(
    googleRedirectRecoveryCookieName,
    createClearGoogleRedirectRecoveryCookieOptions(),
  )

  const context =
    await consumeGoogleRedirectRecoveryState(
      recoveryState,
    )

  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    success: true,
    data: context,
  })
}

export async function prepareGoogleRedirectLogin(
  req,
  res,
  next,
) {
  const {
    context,
    bindingCookieName,
  } = await consumeGoogleRedirectState(
    req.validatedBody.state,
    req.cookies,
  )

  res.clearCookie(
    bindingCookieName,
    createClearGoogleRedirectBindingCookieOptions(),
  )
  req.googleRedirectContext = context
  next()
}

export async function googleRedirectLogin(
  req,
  res,
) {
  const context = req.googleRedirectContext

  const authentication =
    await authenticateWithGoogle({
      credential:
        req.validatedBody.credential,
      invitationToken:
        context.invitationToken,
    })

  setAuthenticationCookie(res, authentication)
  res.setHeader('Cache-Control', 'no-store')
  res.redirect(303, context.returnTo)
}

export async function handleGoogleRedirectError(
  error,
  req,
  res,
  next,
) {
  if (
    res.headersSent ||
    (error?.isOperational !== true &&
      !googleRedirectRequestErrorTypes.has(
        error?.type,
      ))
  ) {
    next(error)
    return
  }

  let context = req.googleRedirectContext

  const errorCode = googleRedirectErrorCodes.has(
    error.code,
  )
    ? error.code
    : 'GOOGLE_AUTH_INVALID'
  const redirectPath =
    context?.mode === 'register'
      ? '/register'
      : '/login'
  const redirectUrl = new URL(
    redirectPath,
    'https://living-memory.invalid',
  )

  redirectUrl.searchParams.set(
    'googleError',
    errorCode,
  )

  if (context) {
    let recovery

    try {
      recovery =
        await createGoogleRedirectRecoveryState(
          context,
        )
    } catch {
      recovery = null
    }

    if (recovery) {
      res.cookie(
        googleRedirectRecoveryCookieName,
        recovery.state,
        createGoogleRedirectRecoveryCookieOptions(
          recovery.expiresAt,
        ),
      )
      redirectUrl.searchParams.set(
        'googleRecovery',
        '1',
      )
    }
  }

  res.setHeader('Cache-Control', 'no-store')
  res.redirect(
    303,
    `${redirectUrl.pathname}${redirectUrl.search}`,
  )
}

export async function forgotPassword(
  req,
  res,
) {
  await requestPasswordReset(
    req.validatedBody,
  )

  res.status(202).json({
    success: true,
    data: {
      accepted: true,
    },
  })
}

export async function resetPassword(req, res) {
  await resetUserPassword(
    req.validatedBody,
  )

  res.status(200).json({
    success: true,
    data: {
      reset: true,
    },
  })
}

export async function refresh(req, res) {
  const refreshToken =
    req.cookies?.[refreshCookieName]

  const authentication =
    await refreshAuthentication(refreshToken)

  sendAuthenticationResponse(
    res,
    authentication,
  )
}

export async function logout(req, res) {
  const refreshToken =
    req.cookies?.[refreshCookieName]

  await logoutUser(refreshToken)

  res.clearCookie(
    refreshCookieName,
    createClearRefreshCookieOptions(),
  )

  res.status(204).send()
}

export async function me(req, res) {
  const user = await getCurrentUser(
    req.auth.userId,
  )

  res.status(200).json({
    success: true,
    data: {
      user,
    },
  })
}
