import {
    afterEach,
    describe,
    expect,
    it,
    vi,
  } from 'vitest'

  const mocks = vi.hoisted(() => ({
    createMemoryProfile: vi.fn(),
    findMemoryProfiles: vi.fn(),
    findMemoryProfile: vi.fn(),
    sortMemoryProfiles: vi.fn(),
  }))

  vi.mock(
    '../src/modules/memories/MemoryProfile.js',
    () => ({
      default: {
        create: mocks.createMemoryProfile,
        find: mocks.findMemoryProfiles,
        findOne: mocks.findMemoryProfile,
      },
    }),
  )

  import {
    createMemoryProfile,
    getMemoryProfile,
    listMemoryProfiles,
  } from '../src/modules/memories/memoryService.js'

  const memoryId =
    '507f1f77bcf86cd799439011'

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

  describe('Memory service', () => {
    it('creates an owner-scoped memory profile', async () => {
      mocks.createMemoryProfile.mockResolvedValue({
        toJSON: () => publicMemoryProfile,
      })

      const result = await createMemoryProfile(
        'user-id',
        {
          subjectName: '  Sarah Cohen  ',
          relationship: '  Grandmother  ',
          description: '  Family stories.  ',
        },
      )

      expect(
        mocks.createMemoryProfile,
      ).toHaveBeenCalledWith({
        ownerId: 'user-id',
        subjectName: 'Sarah Cohen',
        relationship: 'Grandmother',
        description: 'Family stories.',
      })

      expect(result).toEqual(
        publicMemoryProfile,
      )
    })

    it('lists only active profiles belonging to the user', async () => {
      mocks.findMemoryProfiles.mockReturnValue({
        sort: mocks.sortMemoryProfiles,
      })

      mocks.sortMemoryProfiles.mockResolvedValue([
        {
          toJSON: () => publicMemoryProfile,
        },
      ])

      const result =
        await listMemoryProfiles('user-id')

      expect(
        mocks.findMemoryProfiles,
      ).toHaveBeenCalledWith({
        ownerId: 'user-id',
        status: 'active',
      })

      expect(
        mocks.sortMemoryProfiles,
      ).toHaveBeenCalledWith({
        createdAt: -1,
      })

      expect(result).toEqual([
        publicMemoryProfile,
      ])
    })

    it('returns an owner-scoped memory profile', async () => {
      mocks.findMemoryProfile.mockResolvedValue({
        toJSON: () => publicMemoryProfile,
      })

      const result = await getMemoryProfile(
        'user-id',
        memoryId,
      )

      expect(
        mocks.findMemoryProfile,
      ).toHaveBeenCalledWith({
        _id: memoryId,
        ownerId: 'user-id',
        status: 'active',
      })

      expect(result).toEqual(
        publicMemoryProfile,
      )
    })

    it('returns a safe error for an unavailable profile', async () => {
      mocks.findMemoryProfile.mockResolvedValue(null)

      await expect(
        getMemoryProfile(
          'user-id',
          memoryId,
        ),
      ).rejects.toMatchObject({
        name: 'AppError',
        statusCode: 404,
        code: 'MEMORY_NOT_FOUND',
      })
    })

    it('rejects an invalid memory ID', async () => {
      await expect(
        getMemoryProfile(
          'user-id',
          'invalid-memory-id',
        ),
      ).rejects.toMatchObject({
        name: 'ZodError',
      })

      expect(
        mocks.findMemoryProfile,
      ).not.toHaveBeenCalled()
    })

    it('rejects invalid input before database access', async () => {
      await expect(
        createMemoryProfile('user-id', {
          subjectName: 'A',
          ownerId: 'another-user-id',
        }),
      ).rejects.toMatchObject({
        name: 'ZodError',
      })

      expect(
        mocks.createMemoryProfile,
      ).not.toHaveBeenCalled()
    })

    it('rejects a missing authenticated user ID', async () => {
      await expect(
        createMemoryProfile('', {
          subjectName: 'Sarah Cohen',
        }),
      ).rejects.toThrow(
        'User ID must be a non-empty string.',
      )

      await expect(
        listMemoryProfiles(undefined),
      ).rejects.toThrow(
        'User ID must be a non-empty string.',
      )

      expect(
        mocks.createMemoryProfile,
      ).not.toHaveBeenCalled()

      expect(
        mocks.findMemoryProfiles,
      ).not.toHaveBeenCalled()
    })
  })
