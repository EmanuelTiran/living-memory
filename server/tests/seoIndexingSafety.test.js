import request from 'supertest'
import { describe, expect, it } from 'vitest'

import app from '../src/app.js'

describe('SEO indexing safety', () => {
  it.each([
    '/app',
    '/app/memories/example',
    '/login',
    '/register',
    '/invitation',
  ])('prevents indexing %s', async (path) => {
    const response = await request(app).get(path)

    expect(response.headers['x-robots-tag']).toBe(
      'noindex, nofollow',
    )
  })

  it('prevents indexing the health API without changing its behavior', async () => {
    const response = await request(app).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.headers['x-robots-tag']).toBe(
      'noindex, nofollow',
    )
    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: 'ok',
        service: 'living-memory-api',
      },
    })
    expect(response.body.data.timestamp).toEqual(
      expect.any(String),
    )
    expect(
      Number.isNaN(Date.parse(response.body.data.timestamp)),
    ).toBe(false)
  })

  it('does not prevent indexing the public root route', async () => {
    const response = await request(app).get('/')

    expect(response.headers['x-robots-tag']).toBeUndefined()
  })
})
