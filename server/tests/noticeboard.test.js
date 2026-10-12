import { existsSync, readFileSync } from 'node:fs'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/config/env.js', async (original) => {
  const actual = await original()
  return { ...actual, env: { ...actual.env, serveClientBuild: true } }
})

import app from '../src/app.js'

const build = new URL('../../client/dist/', import.meta.url)
const pages = [
  ['/noticeboard', 'index.html'],
  ['/noticeboard/privacy', 'privacy.html'],
  ['/noticeboard/terms', 'terms.html'],
  ['/noticeboard/support', 'support.html'],
]

// Exercise the actual production build. Run `npm run build` before this suite.
describe.skipIf(!existsSync(new URL('index.html', build)))('Notice Board production routing (requires client build)', () => {
  it.each(pages)('serves %s publicly before the SPA fallback', async (route, file) => {
    const response = await request(app).get(route)
    const expected = readFileSync(new URL(`noticeboard/${file}`, build), 'utf8')
    const source = readFileSync(new URL(`../../client/public/noticeboard/${file}`, import.meta.url), 'utf8')

    expect(expected).toBe(source)
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('text/html')
    expect(response.headers.location).toBeUndefined()
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(response.headers['x-robots-tag']).toBeUndefined()
    expect(response.text).toBe(expected)
    expect(response.text).toContain('lang="he" dir="rtl"')
    expect(response.text).not.toContain('<script')

    const trailingSlash = await request(app).get(`${route}/`)
    expect(trailingSlash.status).toBe(200)
    expect(trailingSlash.text).toBe(expected)

    const head = await request(app).head(route)
    expect(head.status).toBe(200)
    expect(head.headers['content-type']).toContain('text/html')
  })

  it('keeps the existing homepage and login/system SPA routes unchanged', async () => {
    const spa = readFileSync(new URL('index.html', build), 'utf8')
    for (const route of ['/', '/login', '/register', '/app', '/app/memories/example']) {
      const response = await request(app).get(route).set('Accept', 'text/html')
      expect(response.status).toBe(200)
      expect(response.text).toBe(spa)
    }
  })

  it('serves every local page link and asset, including real fragment targets', async () => {
    for (const [route] of pages) {
      const response = await request(app).get(route)
      const links = [...response.text.matchAll(/(?:href|src)="([^"]+)"/g)]
      for (const [, link] of links) {
        if (link.startsWith('#')) {
          expect(response.text).toContain(`id="${link.slice(1)}"`)
        } else if (link.startsWith('/')) {
          const url = new URL(link, 'https://zikaron-hai.co.il')
          const target = await request(app).get(url.pathname)
          expect(target.status).toBe(200)
          if (url.pathname.endsWith('.css')) {
            expect(target.headers['content-type']).toContain('text/css')
          } else {
            expect(pages.map(([path]) => path)).toContain(url.pathname)
            if (url.hash) {
              expect(target.text).toContain(`id="${url.hash.slice(1)}"`)
            }
          }
        } else {
          expect(link.startsWith('mailto:') || link.startsWith('https://')).toBe(true)
        }
      }
    }
  })

  it('keeps the health API and unknown API behavior intact', async () => {
    const health = await request(app).get('/api/health')
    expect(health.status).toBe(200)
    expect(health.body.data.service).toBe('living-memory-api')
    const unknown = await request(app).get('/api/noticeboard')
    expect(unknown.status).toBe(404)
    expect(unknown.body.error.code).toBe('ROUTE_NOT_FOUND')
  })
})
