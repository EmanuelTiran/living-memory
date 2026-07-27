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
  archiveMemoryStory: vi.fn(),
  createMemoryStory: vi.fn(),
  listMemoryStories: vi.fn(),
  updateMemoryStory: vi.fn(),
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
    archiveMemoryStory:
      mocks.archiveMemoryStory,
    createMemoryStory:
      mocks.createMemoryStory,
    listMemoryStories:
      mocks.listMemoryStories,
    updateMemoryStory:
      mocks.updateMemoryStory,
  }),
)

import app from '../src/app.js'

const userId =
  '507f1f77bcf86cd799439011'

const memoryId =
  '507f191e810c19729de860ea'

const storyId =
  '507f191e810c19729de860eb'

describe('memory story management routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates a memory story', async () => {
    const updatedStory = {
      id: storyId,
      title: 'כותרת מעודכנת',
      content:
        'זהו תוכן מעודכן של הסיפור.',
      occurredOn: '',
      status: 'draft',
    }

    mocks.updateMemoryStory
      .mockResolvedValue(updatedStory)

    const response = await request(app)
      .patch(
        `/api/memories/${memoryId}/stories/${storyId}`,
      )
      .send({
        title: 'כותרת מעודכנת',
        content:
          'זהו תוכן מעודכן של הסיפור.',
        occurredOn: '',
      })

    expect(response.status).toBe(200)

    expect(response.body).toEqual({
      success: true,
      data: {
        memoryStory: updatedStory,
      },
    })

    expect(
      mocks.updateMemoryStory,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
      storyId,
      {
        title: 'כותרת מעודכנת',
        content:
          'זהו תוכן מעודכן של הסיפור.',
        occurredOn: '',
      },
    )
  })

  it('archives a memory story', async () => {
    mocks.archiveMemoryStory
      .mockResolvedValue({
        id: storyId,
        status: 'archived',
      })

    const response = await request(app)
      .delete(
        `/api/memories/${memoryId}/stories/${storyId}`,
      )

    expect(response.status).toBe(204)
    expect(response.body).toEqual({})

    expect(
      mocks.archiveMemoryStory,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
      storyId,
    )
  })

  it('rejects an empty update', async () => {
    const response = await request(app)
      .patch(
        `/api/memories/${memoryId}/stories/${storyId}`,
      )
      .send({})

    expect(response.status).toBe(400)

    expect(
      mocks.updateMemoryStory,
    ).not.toHaveBeenCalled()
  })
})