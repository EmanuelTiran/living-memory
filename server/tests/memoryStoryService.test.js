import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
  } from 'vitest'

  const mocks = vi.hoisted(() => ({
    memoryProfileExists: vi.fn(),
    memoryStoryCreate: vi.fn(),
    memoryStoryFind: vi.fn(),
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
        create: mocks.memoryStoryCreate,
        find: mocks.memoryStoryFind,
      },
    }),
  )

  import {
    createMemoryStory,
    listMemoryStories,
  } from '../src/modules/memories/memoryStoryService.js'

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

  describe('memory story service', () => {
    beforeEach(() => {
      vi.clearAllMocks()

      mocks.memoryProfileExists.mockResolvedValue({
        _id: memoryId,
      })
    })

    it('creates a story inside an owned memory', async () => {
      mocks.memoryStoryCreate.mockResolvedValue({
        toJSON: () => memoryStory,
      })

      const result = await createMemoryStory(
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

      expect(
        mocks.memoryProfileExists,
      ).toHaveBeenCalledWith({
        _id: memoryId,
        ownerId: userId,
        status: 'active',
      })

      expect(
        mocks.memoryStoryCreate,
      ).toHaveBeenCalledWith({
        memoryId,
        authorId: userId,
        title:
          'הטיול המשפחתי הראשון',
        content:
          'זהו סיפור על הטיול המשפחתי הראשון שלנו.',
        occurredOn: '1998-05-12',
      })

      expect(result).toEqual(memoryStory)
    })

    it('stores an empty date when none is provided', async () => {
      mocks.memoryStoryCreate.mockResolvedValue({
        toJSON: () => ({
          ...memoryStory,
          occurredOn: '',
        }),
      })

      await createMemoryStory(
        userId,
        memoryId,
        {
          title: 'סיפור ללא תאריך',
          content:
            'זהו סיפור שאין עבורו תאריך מדויק.',
        },
      )

      expect(
        mocks.memoryStoryCreate,
      ).toHaveBeenCalledWith({
        memoryId,
        authorId: userId,
        title: 'סיפור ללא תאריך',
        content:
          'זהו סיפור שאין עבורו תאריך מדויק.',
        occurredOn: '',
      })
    })

    it('does not create a story outside an owned memory', async () => {
      mocks.memoryProfileExists.mockResolvedValue(
        null,
      )

      await expect(
        createMemoryStory(
          userId,
          memoryId,
          {
            title: 'סיפור פרטי',
            content:
              'הסיפור הזה שייך לזיכרון של משתמש אחר.',
          },
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'MEMORY_NOT_FOUND',
      })

      expect(
        mocks.memoryStoryCreate,
      ).not.toHaveBeenCalled()
    })

    it('lists stories from an owned memory', async () => {
      const sortStories = vi
        .fn()
        .mockResolvedValue([
          {
            toJSON: () => memoryStory,
          },
        ])

      mocks.memoryStoryFind.mockReturnValue({
        sort: sortStories,
      })

      const result = await listMemoryStories(
        userId,
        memoryId,
      )

      expect(
        mocks.memoryStoryFind,
      ).toHaveBeenCalledWith({
        memoryId,
        status: {
          $in: ['draft', 'approved'],
        },
      })

      expect(sortStories).toHaveBeenCalledWith({
        createdAt: -1,
      })

      expect(result).toEqual([memoryStory])
    })

    it('does not list stories outside an owned memory', async () => {
      mocks.memoryProfileExists.mockResolvedValue(
        null,
      )

      await expect(
        listMemoryStories(
          userId,
          memoryId,
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'MEMORY_NOT_FOUND',
      })

      expect(
        mocks.memoryStoryFind,
      ).not.toHaveBeenCalled()
    })
  })
