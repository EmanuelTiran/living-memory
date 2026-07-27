import request from 'supertest'
import { describe, expect, it } from 'vitest'
import app from '../src/app.js'

describe('API infrastructure', () => {
  it('adds a request ID to every response', async () => {
    const response = await request(app).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.headers['x-request-id']).toEqual(
      expect.any(String),
    )
  })

  it('returns a consistent response for unknown routes', async () => {
    const response = await request(app).get('/api/unknown-route')

    expect(response.status).toBe(404)

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Route not found.',
        requestId: response.headers['x-request-id'],
      },
    })
  })

  it('returns a safe response for invalid JSON', async () => {
    const response = await request(app)
      .post('/api/unknown-route')
      .set('Content-Type', 'application/json')
      .send('{"invalid":')

    expect(response.status).toBe(400)

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Request body contains invalid JSON.',
        requestId: response.headers['x-request-id'],
      },
    })
  })
})