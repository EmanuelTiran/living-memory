import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
  } from 'vitest'

  const mocks = vi.hoisted(() => ({
    memoryProfileExists: vi.fn(),
    memoryStoryFindOneAndUpdate:
      vi.fn(),
  }))

  vi.mock(
    '../src/modules/memories/MemoryProfile.js',
    () => ({
      default: {
        exists: mocks.memoryProfileExists,
      },
    }),
  )

  vi.mock(
    '../src/modules/memories/MemoryStory.js',
    () => ({
      default: {
        findOneAndUpdate:
          mocks.memoryStoryFindOneAndUpdate,
      },
    }),
  )

  import { approveMemoryStory } from '../src/modules/memories/memoryStoryService.js'

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

  describe('memory story approval', () => {
    beforeEach(() => {
      vi.clearAllMocks()

      mocks.memoryProfileExists.mockResolvedValue({
        _id: memoryId,
      })
    })

    it('approves a story inside an owned memory', async () => {
      mocks.memoryStoryFindOneAndUpdate
        .mockResolvedValue({
          toJSON: () => approvedStory,
        })

      const result = await approveMemoryStory(
        userId,
        memoryId,
        storyId,
      )

      expect(
        mocks.memoryStoryFindOneAndUpdate,
      ).toHaveBeenCalledWith(
        {
          _id: storyId,
          memoryId,
          status: {
            $in: ['draft', 'approved'],
          },
        },
        {
          $set: {
            status: 'approved',
          },
        },
        {
          returnDocument: 'after',
        },
      )

      expect(result).toEqual(approvedStory)
    })

    it('does not approve a story outside an owned memory', async () => {
      mocks.memoryProfileExists.mockResolvedValue(
        null,
      )

      await expect(
        approveMemoryStory(
          userId,
          memoryId,
          storyId,
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'MEMORY_NOT_FOUND',
      })

      expect(
        mocks.memoryStoryFindOneAndUpdate,
      ).not.toHaveBeenCalled()
    })

    it('returns a safe error when the story is missing', async () => {
      mocks.memoryStoryFindOneAndUpdate
        .mockResolvedValue(null)

      await expect(
        approveMemoryStory(
          userId,
          memoryId,
          storyId,
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'STORY_NOT_FOUND',
      })
    })

    it('rejects an invalid story ID', async () => {
      await expect(
        approveMemoryStory(
          userId,
          memoryId,
          'invalid',
        ),
      ).rejects.toMatchObject({
        name: 'ZodError',
      })

      expect(
        mocks.memoryProfileExists,
      ).not.toHaveBeenCalled()
    })
  })
