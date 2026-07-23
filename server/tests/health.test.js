import request from 'supertest'
import { describe, expect, it } from 'vitest'

import app from '../src/app.js'

describe('GET /api/health', () => {
  it('returns the API health status', async () => {
    const response = await request(app).get('/api/health')

    expect(response.status).toBe(200)

    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: 'ok',
        service: 'living-memory-api',
      },
    })

    expect(response.body.data.timestamp).toEqual(expect.any(String))
    expect(Number.isNaN(Date.parse(response.body.data.timestamp))).toBe(false)
  })

  it('does not expose the Express signature', async () => {
    const response = await request(app).get('/api/health')

    expect(response.headers['x-powered-by']).toBeUndefined()
  })
})