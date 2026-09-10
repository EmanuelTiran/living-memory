export function securityHeaders(
  req,
  res,
  next,
) {
  const googlePopupDocument =
    req.method === 'GET' &&
    /^\/(?:login|register)\/?$/.test(
      req.path,
    ) &&
    req.accepts('html')

  res.setHeader(
    'X-Content-Type-Options',
    'nosniff',
  )
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader(
    'Referrer-Policy',
    'strict-origin-when-cross-origin',
  )
  res.setHeader(
    'Permissions-Policy',
    'camera=(), geolocation=(), microphone=(self)',
  )
  res.setHeader(
    'Cross-Origin-Opener-Policy',
    googlePopupDocument
      ? 'same-origin-allow-popups'
      : 'same-origin',
  )

  next()
}
