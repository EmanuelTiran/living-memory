import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
  } from 'vitest'

  const mocks = vi.hoisted(() => ({
    memoryProfileFindOneAndUpdate:
      vi.fn(),
  }))

  vi.mock(
    '../src/modules/memories/MemoryProfile.js',
    () => ({
      default: {
        findOneAndUpdate:
          mocks.memoryProfileFindOneAndUpdate,
      },
    }),
  )

  import {
    archiveMemoryProfile,
    updateMemoryProfile,
  } from '../src/modules/memories/memoryService.js'

  const userId =
    '507f1f77bcf86cd799439011'

  const memoryId =
    '507f191e810c19729de860ea'

  describe('memory profile management', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('updates an owned memory profile', async () => {
      const updatedProfile = {
        id: memoryId,
        ownerId: userId,
        subjectName: 'שרה כהן',
        relationship: 'סבתא',
        description:
          'סיפורים משפחתיים מעודכנים.',
        status: 'active',
      }

      mocks.memoryProfileFindOneAndUpdate
        .mockResolvedValue({
          toJSON: () => updatedProfile,
        })

      const result =
        await updateMemoryProfile(
          userId,
          memoryId,
          {
            subjectName: '  שרה כהן  ',
            relationship: '  סבתא  ',
            description:
              '  סיפורים משפחתיים מעודכנים.  ',
          },
        )

      expect(
        mocks.memoryProfileFindOneAndUpdate,
      ).toHaveBeenCalledWith(
        {
          _id: memoryId,
          ownerId: userId,
          status: 'active',
        },
        {
          $set: {
            subjectName: 'שרה כהן',
            relationship: 'סבתא',
            description:
              'סיפורים משפחתיים מעודכנים.',
          },
        },
        {
          returnDocument: 'after',
        },
      )

      expect(result).toEqual(updatedProfile)
    })

    it('allows clearing optional profile fields', async () => {
      mocks.memoryProfileFindOneAndUpdate
        .mockResolvedValue({
          toJSON: () => ({
            id: memoryId,
            relationship: '',
            description: '',
          }),
        })

      await updateMemoryProfile(
        userId,
        memoryId,
        {
          relationship: '   ',
          description: '',
        },
      )

      expect(
        mocks.memoryProfileFindOneAndUpdate,
      ).toHaveBeenCalledWith(
        expect.any(Object),
        {
          $set: {
            relationship: '',
            description: '',
          },
        },
        {
          returnDocument: 'after',
        },
      )
    })

    it('rejects an empty profile update', async () => {
      await expect(
        updateMemoryProfile(
          userId,
          memoryId,
          {},
        ),
      ).rejects.toMatchObject({
        name: 'ZodError',
      })

      expect(
        mocks.memoryProfileFindOneAndUpdate,
      ).not.toHaveBeenCalled()
    })

    it('archives an owned memory profile', async () => {
      const archivedProfile = {
        id: memoryId,
        ownerId: userId,
        status: 'archived',
      }

      mocks.memoryProfileFindOneAndUpdate
        .mockResolvedValue({
          toJSON: () => archivedProfile,
        })

      const result =
        await archiveMemoryProfile(
          userId,
          memoryId,
        )

      expect(
        mocks.memoryProfileFindOneAndUpdate,
      ).toHaveBeenCalledWith(
        {
          _id: memoryId,
          ownerId: userId,
          status: 'active',
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

      expect(result).toEqual(archivedProfile)
    })

    it('returns a safe error for a missing memory', async () => {
      mocks.memoryProfileFindOneAndUpdate
        .mockResolvedValue(null)

      await expect(
        updateMemoryProfile(
          userId,
          memoryId,
          {
            subjectName: 'שרה כהן',
          },
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'MEMORY_NOT_FOUND',
      })
    })
  })
