import request from 'supertest'
import { describe, expect, it } from 'vitest'

import app from '../src/app.js'

describe('Private-pilot deployment readiness', () => {
  it('adds baseline browser security headers', async () => {
    const response = await request(app).get('/api/health')

    expect(
      response.headers['x-content-type-options'],
    ).toBe('nosniff')
    expect(
      response.headers['x-frame-options'],
    ).toBe('DENY')
    expect(
      response.headers['referrer-policy'],
    ).toBe('strict-origin-when-cross-origin')
    expect(
      response.headers['permissions-policy'],
    ).toContain('microphone=(self)')
  })

  it('reports readiness without exposing storage paths', async () => {
    const response = await request(app).get('/api/ready')

    expect([200, 503]).toContain(response.status)
    expect(response.body.data).toMatchObject({
      status: expect.stringMatching(
        /^(ready|not_ready)$/,
      ),
      database: expect.stringMatching(
        /^(ready|not_ready)$/,
      ),
      storage: expect.stringMatching(
        /^(ready|not_ready)$/,
      ),
    })
    expect(JSON.stringify(response.body)).not.toContain(
      'uploads',
    )
  })
})
