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

  import {
    archiveMemoryStory,
    updateMemoryStory,
  } from '../src/modules/memories/memoryStoryService.js'

  const userId =
    '507f1f77bcf86cd799439011'

  const memoryId =
    '507f191e810c19729de860ea'

  const storyId =
    '507f191e810c19729de860eb'

  describe('memory story management', () => {
    beforeEach(() => {
      vi.clearAllMocks()

      mocks.memoryProfileExists.mockResolvedValue({
        _id: memoryId,
      })
    })

    it('updates a story and returns it to draft', async () => {
      const updatedStory = {
        id: storyId,
        title: 'כותרת מעודכנת',
        content:
          'זהו התוכן המעודכן של הסיפור המשפחתי.',
        occurredOn: '1999-06-20',
        status: 'draft',
      }

      mocks.memoryStoryFindOneAndUpdate
        .mockResolvedValue({
          toJSON: () => updatedStory,
        })

      const result = await updateMemoryStory(
        userId,
        memoryId,
        storyId,
        {
          title: '  כותרת מעודכנת  ',
          content:
            '  זהו התוכן המעודכן של הסיפור המשפחתי.  ',
          occurredOn: '1999-06-20',
        },
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
            title: 'כותרת מעודכנת',
            content:
              'זהו התוכן המעודכן של הסיפור המשפחתי.',
            occurredOn: '1999-06-20',
            status: 'draft',
          },
        },
        {
          returnDocument: 'after',
        },
      )

      expect(result).toEqual(updatedStory)
    })

    it('allows clearing the occurred date', async () => {
      mocks.memoryStoryFindOneAndUpdate
        .mockResolvedValue({
          toJSON: () => ({
            id: storyId,
            occurredOn: '',
            status: 'draft',
          }),
        })

      await updateMemoryStory(
        userId,
        memoryId,
        storyId,
        {
          occurredOn: '',
        },
      )

      expect(
        mocks.memoryStoryFindOneAndUpdate,
      ).toHaveBeenCalledWith(
        expect.any(Object),
        {
          $set: {
            occurredOn: '',
            status: 'draft',
          },
        },
        {
          returnDocument: 'after',
        },
      )
    })

    it('rejects an empty update', async () => {
      await expect(
        updateMemoryStory(
          userId,
          memoryId,
          storyId,
          {},
        ),
      ).rejects.toMatchObject({
        name: 'ZodError',
      })

      expect(
        mocks.memoryProfileExists,
      ).not.toHaveBeenCalled()
    })

    it('does not update a story outside an owned memory', async () => {
      mocks.memoryProfileExists.mockResolvedValue(
        null,
      )

      await expect(
        updateMemoryStory(
          userId,
          memoryId,
          storyId,
          {
            title: 'כותרת חדשה',
          },
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'MEMORY_NOT_FOUND',
      })

      expect(
        mocks.memoryStoryFindOneAndUpdate,
      ).not.toHaveBeenCalled()
    })

    it('archives a story', async () => {
      const archivedStory = {
        id: storyId,
        status: 'archived',
      }

      mocks.memoryStoryFindOneAndUpdate
        .mockResolvedValue({
          toJSON: () => archivedStory,
        })

      const result = await archiveMemoryStory(
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
            status: 'archived',
          },
        },
        {
          returnDocument: 'after',
        },
      )

      expect(result).toEqual(archivedStory)
    })

    it('returns a safe error for a missing story', async () => {
      mocks.memoryStoryFindOneAndUpdate
        .mockResolvedValue(null)

      await expect(
        archiveMemoryStory(
          userId,
          memoryId,
          storyId,
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'STORY_NOT_FOUND',
      })
    })
  })
