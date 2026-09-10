import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  securityHeaders,
} from '../src/middleware/securityHeaders.js'

function collectHeaders({
  method,
  path,
  acceptsHtml,
}) {
  const headers = new Map()
  const request = {
    method,
    path,
    accepts: vi
      .fn()
      .mockReturnValue(
        acceptsHtml ? 'html' : false,
      ),
  }
  const response = {
    setHeader(name, value) {
      headers.set(name, value)
    },
  }
  const next = vi.fn()

  securityHeaders(request, response, next)

  expect(next).toHaveBeenCalledOnce()
  return headers
}

describe('Security headers', () => {
  it.each([
    '/login',
    '/login/',
    '/register',
    '/register/',
  ])(
    'allows GIS popup communication for the SPA document %s',
    (path) => {
      const headers = collectHeaders({
        method: 'GET',
        path,
        acceptsHtml: true,
      })

      expect(
        headers.get('Cross-Origin-Opener-Policy'),
      ).toBe('same-origin-allow-popups')
      expect(headers.get('X-Frame-Options')).toBe(
        'DENY',
      )
    },
  )

  it.each([
    {
      method: 'GET',
      path: '/',
      acceptsHtml: true,
    },
    {
      method: 'GET',
      path: '/app',
      acceptsHtml: true,
    },
    {
      method: 'GET',
      path: '/invitation',
      acceptsHtml: true,
    },
    {
      method: 'GET',
      path: '/api/health',
      acceptsHtml: false,
    },
    {
      method: 'POST',
      path: '/api/auth/google',
      acceptsHtml: false,
    },
    {
      method: 'GET',
      path: '/assets/app.js',
      acceptsHtml: false,
    },
  ])(
    'retains same-origin isolation for $method $path',
    ({ method, path, acceptsHtml }) => {
      const headers = collectHeaders({
        method,
        path,
        acceptsHtml,
      })

      expect(
        headers.get('Cross-Origin-Opener-Policy'),
      ).toBe('same-origin')
    },
  )
})
