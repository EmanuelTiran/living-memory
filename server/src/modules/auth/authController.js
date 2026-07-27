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

function sendAuthenticationResponse(
  res,
  {
    user,
    accessToken,
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