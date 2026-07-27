import request from 'supertest'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  approveMemoryStory: vi.fn(),
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
    approveMemoryStory:
      mocks.approveMemoryStory,
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

const storyId =
  '507f191e810c19729de860eb'

const approvedStory = {
  id: storyId,
  memoryId,
  authorId: userId,
  title: 'סיפור שאושר',
  content:
    'זהו סיפור שאושר לשימוש עתידי בזיכרון.',
  occurredOn: '',
  status: 'approved',
}

describe('memory story approval route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('approves a valid memory story', async () => {
    mocks.approveMemoryStory
      .mockResolvedValue(approvedStory)

    const response = await request(app)
      .patch(
        `/api/memories/${memoryId}/stories/${storyId}/approve`,
      )

    expect(response.status).toBe(200)

    expect(response.body).toEqual({
      success: true,
      data: {
        memoryStory: approvedStory,
      },
    })

    expect(
      mocks.approveMemoryStory,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
      storyId,
    )
  })

  it('rejects an invalid story ID', async () => {
    const response = await request(app)
      .patch(
        `/api/memories/${memoryId}/stories/invalid/approve`,
      )

    expect(response.status).toBe(400)

    expect(
      mocks.approveMemoryStory,
    ).not.toHaveBeenCalled()
  })
})