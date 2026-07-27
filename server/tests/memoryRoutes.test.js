import request from 'supertest'
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { AppError } from '../src/errors/AppError.js'

const mocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  archiveMemoryProfile: vi.fn(),
  createMemoryProfile: vi.fn(),
  getMemoryProfile: vi.fn(),
  listMemoryProfiles: vi.fn(),
  updateMemoryProfile: vi.fn(),
}))

vi.mock('../src/modules/auth/tokens.js', () => ({
  verifyAccessToken: mocks.verifyAccessToken,
}))

vi.mock(
  '../src/modules/memories/memoryService.js',
  () => ({
    archiveMemoryProfile:
      mocks.archiveMemoryProfile,
    createMemoryProfile:
      mocks.createMemoryProfile,
    getMemoryProfile:
      mocks.getMemoryProfile,
    listMemoryProfiles:
      mocks.listMemoryProfiles,
    updateMemoryProfile:
      mocks.updateMemoryProfile,
  }),
)

import app from '../src/app.js'

const memoryId =
  '507f1f77bcf86cd799439011'

const authentication = {
  userId: 'user-id',
  systemRole: 'user',
  tokenId: 'token-id',
  expiresAt: new Date(
    Date.now() + 15 * 60 * 1000,
  ),
}

const publicMemoryProfile = {
  id: memoryId,
  ownerId: 'user-id',
  subjectName: 'Sarah Cohen',
  relationship: 'Grandmother',
  description: 'Family stories.',
  visibility: 'private',
  status: 'active',
}

afterEach(() => {
  vi.resetAllMocks()
})

describe('Memory routes', () => {
  it('creates a memory for the authenticated user', async () => {
    mocks.verifyAccessToken.mockResolvedValue(
      authentication,
    )

    mocks.createMemoryProfile.mockResolvedValue(
      publicMemoryProfile,
    )

    const response = await request(app)
      .post('/api/memories')
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )
      .send({
        subjectName: '  Sarah Cohen  ',
        relationship: '  Grandmother  ',
        description: '  Family stories.  ',
      })

    expect(response.status).toBe(201)

    expect(
      mocks.createMemoryProfile,
    ).toHaveBeenCalledWith(
      'user-id',
      {
        subjectName: 'Sarah Cohen',
        relationship: 'Grandmother',
        description: 'Family stories.',
      },
    )

    expect(response.body).toEqual({
      success: true,
      data: {
        memoryProfile:
          publicMemoryProfile,
      },
    })
  })

  it('lists the authenticated user memories', async () => {
    mocks.verifyAccessToken.mockResolvedValue(
      authentication,
    )

    mocks.listMemoryProfiles.mockResolvedValue([
      publicMemoryProfile,
    ])

    const response = await request(app)
      .get('/api/memories')
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )

    expect(response.status).toBe(200)

    expect(
      mocks.listMemoryProfiles,
    ).toHaveBeenCalledWith('user-id')

    expect(response.body).toEqual({
      success: true,
      data: {
        memoryProfiles: [
          publicMemoryProfile,
        ],
      },
    })
  })

  it('returns an authenticated user memory', async () => {
    mocks.verifyAccessToken.mockResolvedValue(
      authentication,
    )

    mocks.getMemoryProfile.mockResolvedValue(
      publicMemoryProfile,
    )

    const response = await request(app)
      .get(`/api/memories/${memoryId}`)
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )

    expect(response.status).toBe(200)

    expect(
      mocks.getMemoryProfile,
    ).toHaveBeenCalledWith(
      'user-id',
      memoryId,
    )

    expect(response.body).toEqual({
      success: true,
      data: {
        memoryProfile:
          publicMemoryProfile,
      },
    })
  })

  it('updates an authenticated user memory', async () => {
    const updatedProfile = {
      ...publicMemoryProfile,
      subjectName: 'שרה כהן',
      relationship: 'סבתא',
    }

    mocks.verifyAccessToken.mockResolvedValue(
      authentication,
    )

    mocks.updateMemoryProfile.mockResolvedValue(
      updatedProfile,
    )

    const response = await request(app)
      .patch(`/api/memories/${memoryId}`)
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )
      .send({
        subjectName: '  שרה כהן  ',
        relationship: '  סבתא  ',
      })

    expect(response.status).toBe(200)

    expect(
      mocks.updateMemoryProfile,
    ).toHaveBeenCalledWith(
      'user-id',
      memoryId,
      {
        subjectName: 'שרה כהן',
        relationship: 'סבתא',
      },
    )

    expect(response.body).toEqual({
      success: true,
      data: {
        memoryProfile: updatedProfile,
      },
    })
  })

  it('archives an authenticated user memory', async () => {
    mocks.verifyAccessToken.mockResolvedValue(
      authentication,
    )

    mocks.archiveMemoryProfile.mockResolvedValue({
      ...publicMemoryProfile,
      status: 'archived',
    })

    const response = await request(app)
      .delete(`/api/memories/${memoryId}`)
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )

    expect(response.status).toBe(204)
    expect(response.body).toEqual({})

    expect(
      mocks.archiveMemoryProfile,
    ).toHaveBeenCalledWith(
      'user-id',
      memoryId,
    )
  })

  it('rejects an empty memory update', async () => {
    mocks.verifyAccessToken.mockResolvedValue(
      authentication,
    )

    const response = await request(app)
      .patch(`/api/memories/${memoryId}`)
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )
      .send({})

    expect(response.status).toBe(400)

    expect(
      mocks.updateMemoryProfile,
    ).not.toHaveBeenCalled()
  })

  it('returns a safe not-found response', async () => {
    mocks.verifyAccessToken.mockResolvedValue(
      authentication,
    )

    mocks.getMemoryProfile.mockRejectedValue(
      new AppError(
        'Memory profile was not found.',
        {
          statusCode: 404,
          code: 'MEMORY_NOT_FOUND',
        },
      ),
    )

    const response = await request(app)
      .get(`/api/memories/${memoryId}`)
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )

    expect(response.status).toBe(404)

    expect(response.body.error).toMatchObject({
      code: 'MEMORY_NOT_FOUND',
      message:
        'Memory profile was not found.',
      requestId: expect.any(String),
    })
  })

  it('rejects an invalid memory ID', async () => {
    mocks.verifyAccessToken.mockResolvedValue(
      authentication,
    )

    const response = await request(app)
      .get('/api/memories/invalid-id')
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )

    expect(response.status).toBe(400)

    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      requestId: expect.any(String),
    })

    expect(
      mocks.getMemoryProfile,
    ).not.toHaveBeenCalled()
  })

  it('rejects invalid memory input', async () => {
    mocks.verifyAccessToken.mockResolvedValue(
      authentication,
    )

    const response = await request(app)
      .post('/api/memories')
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )
      .send({
        subjectName: 'A',
        visibility: 'shared',
      })

    expect(response.status).toBe(400)

    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      requestId: expect.any(String),
    })

    expect(
      mocks.createMemoryProfile,
    ).not.toHaveBeenCalled()
  })

  it('requires authentication for memory access', async () => {
    const createResponse = await request(app)
      .post('/api/memories')
      .send({
        subjectName: 'Sarah Cohen',
      })

    const listResponse = await request(app).get(
      '/api/memories',
    )

    expect(createResponse.status).toBe(401)
    expect(listResponse.status).toBe(401)

    expect(
      mocks.createMemoryProfile,
    ).not.toHaveBeenCalled()

    expect(
      mocks.listMemoryProfiles,
    ).not.toHaveBeenCalled()
  })
})