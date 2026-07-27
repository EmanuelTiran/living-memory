import request from 'supertest'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  createMemoryStory: vi.fn(),
  listMemoryStories: vi.fn(),
}))

vi.mock(
  '../src/middleware/requireAuth.js',
  () => ({
    requireAuth(req, _res, next) {
      req.auth = {
        userId:
          '507f1f77bcf86cd799439011',
      }

      next()
    },
  }),
)

vi.mock(
  '../src/modules/memories/memoryStoryService.js',
  () => ({
    createMemoryStory:
      mocks.createMemoryStory,
    listMemoryStories:
      mocks.listMemoryStories,
  }),
)

import app from '../src/app.js'

const userId =
  '507f1f77bcf86cd799439011'

const memoryId =
  '507f191e810c19729de860ea'

const memoryStory = {
  id: '507f191e810c19729de860eb',
  memoryId,
  authorId: userId,
  title: 'הטיול המשפחתי הראשון',
  content:
    'זהו סיפור על הטיול המשפחתי הראשון שלנו.',
  occurredOn: '1998-05-12',
  status: 'draft',
}

describe('memory story routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a story inside a memory', async () => {
    mocks.createMemoryStory.mockResolvedValue(
      memoryStory,
    )

    const response = await request(app)
      .post(
        `/api/memories/${memoryId}/stories`,
      )
      .send({
        title:
          'הטיול המשפחתי הראשון',
        content:
          'זהו סיפור על הטיול המשפחתי הראשון שלנו.',
        occurredOn: '1998-05-12',
      })

    expect(response.status).toBe(201)

    expect(response.body).toEqual({
      success: true,
      data: {
        memoryStory,
      },
    })

    expect(
      mocks.createMemoryStory,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
      {
        title:
          'הטיול המשפחתי הראשון',
        content:
          'זהו סיפור על הטיול המשפחתי הראשון שלנו.',
        occurredOn: '1998-05-12',
      },
    )
  })

  it('lists stories from a memory', async () => {
    mocks.listMemoryStories.mockResolvedValue([
      memoryStory,
    ])

    const response = await request(app).get(
      `/api/memories/${memoryId}/stories`,
    )

    expect(response.status).toBe(200)

    expect(response.body).toEqual({
      success: true,
      data: {
        memoryStories: [memoryStory],
      },
    })

    expect(
      mocks.listMemoryStories,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
    )
  })

  it('rejects an invalid memory ID', async () => {
    const response = await request(app)
      .get('/api/memories/invalid/stories')

    expect(response.status).toBe(400)

    expect(
      mocks.listMemoryStories,
    ).not.toHaveBeenCalled()
  })

  it('rejects invalid story data', async () => {
    const response = await request(app)
      .post(
        `/api/memories/${memoryId}/stories`,
      )
      .send({
        title: 'א',
        content: 'קצר',
      })

    expect(response.status).toBe(400)

    expect(
      mocks.createMemoryStory,
    ).not.toHaveBeenCalled()
  })
})