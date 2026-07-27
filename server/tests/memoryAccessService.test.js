import {
    afterEach,
    describe,
    expect,
    it,
    vi,
  } from 'vitest'

  const mocks = vi.hoisted(() => ({
    findMemoryProfile: vi.fn(),
    findMemoryMembership: vi.fn(),
  }))

  vi.mock(
    '../src/modules/memories/MemoryProfile.js',
    () => ({
      default: {
        findOne: mocks.findMemoryProfile,
      },
    }),
  )

  vi.mock(
    '../src/modules/memories/MemoryMembership.js',
    () => ({
      default: {
        findOne: mocks.findMemoryMembership,
      },
    }),
  )

  import {
    assertCanChatWithMemory,
    MEMORY_PERMISSIONS,
    requireMemoryPermission,
  } from '../src/modules/memories/memoryAccessService.js'

  const memoryId =
    '507f1f77bcf86cd799439011'

  const ownerId =
    '507f1f77bcf86cd799439012'

  const memberId =
    '507f1f77bcf86cd799439013'

  function createMemoryProfile({
    visibility = 'private',
  } = {}) {
    return {
      _id: memoryId,
      ownerId,
      subjectName: 'Sarah Cohen',
      visibility,
      status: 'active',
    }
  }

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Memory access service', () => {
    it('allows the owner to chat with a private memory', async () => {
      const memoryProfile =
        createMemoryProfile()

      mocks.findMemoryProfile.mockResolvedValue(
        memoryProfile,
      )

      const result =
        await assertCanChatWithMemory(
          ownerId,
          memoryId,
        )

      expect(
        mocks.findMemoryProfile,
      ).toHaveBeenCalledWith({
        _id: memoryId,
        status: 'active',
      })

      expect(
        mocks.findMemoryMembership,
      ).not.toHaveBeenCalled()

      expect(result).toEqual({
        memoryProfile,
        authorization: {
          accessType: 'owner',
          role: 'owner',
          permission: 'chat',
        },
      })
    })

    it.each([
      'viewer',
      'contributor',
      'editor',
    ])(
      'allows an active %s member to chat with a shared memory',
      async (role) => {
        const memoryProfile =
          createMemoryProfile({
            visibility: 'shared',
          })

        mocks.findMemoryProfile.mockResolvedValue(
          memoryProfile,
        )

        mocks.findMemoryMembership.mockResolvedValue({
          memoryId,
          userId: memberId,
          role,
          status: 'active',
        })

        const result =
          await assertCanChatWithMemory(
            memberId,
            memoryId,
          )

        expect(
          mocks.findMemoryMembership,
        ).toHaveBeenCalledWith({
          memoryId,
          userId: memberId,
          status: 'active',
        })

        expect(result.authorization).toEqual({
          accessType: 'membership',
          role,
          permission: 'chat',
        })
      },
    )

    it('does not use memberships while a memory is private', async () => {
      mocks.findMemoryProfile.mockResolvedValue(
        createMemoryProfile(),
      )

      await expect(
        assertCanChatWithMemory(
          memberId,
          memoryId,
        ),
      ).rejects.toMatchObject({
        name: 'AppError',
        statusCode: 404,
        code: 'MEMORY_NOT_FOUND',
      })

      expect(
        mocks.findMemoryMembership,
      ).not.toHaveBeenCalled()
    })

    it('denies a role without the requested permission', async () => {
      mocks.findMemoryProfile.mockResolvedValue(
        createMemoryProfile({
          visibility: 'shared',
        }),
      )

      mocks.findMemoryMembership.mockResolvedValue({
        memoryId,
        userId: memberId,
        role: 'viewer',
        status: 'active',
      })

      await expect(
        requireMemoryPermission(
          memberId,
          memoryId,
          MEMORY_PERMISSIONS.EDIT,
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'MEMORY_NOT_FOUND',
      })
    })

    it('denies a user without an active membership', async () => {
      mocks.findMemoryProfile.mockResolvedValue(
        createMemoryProfile({
          visibility: 'shared',
        }),
      )

      mocks.findMemoryMembership.mockResolvedValue(
        null,
      )

      await expect(
        assertCanChatWithMemory(
          memberId,
          memoryId,
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'MEMORY_NOT_FOUND',
      })
    })

    it('returns a safe error when the memory does not exist', async () => {
      mocks.findMemoryProfile.mockResolvedValue(
        null,
      )

      await expect(
        assertCanChatWithMemory(
          memberId,
          memoryId,
        ),
      ).rejects.toMatchObject({
        name: 'AppError',
        statusCode: 404,
        code: 'MEMORY_NOT_FOUND',
      })

      expect(
        mocks.findMemoryMembership,
      ).not.toHaveBeenCalled()
    })

    it('rejects an unsupported permission before database access', async () => {
      await expect(
        requireMemoryPermission(
          memberId,
          memoryId,
          'delete-system',
        ),
      ).rejects.toThrow(
        'Memory permission is invalid.',
      )

      expect(
        mocks.findMemoryProfile,
      ).not.toHaveBeenCalled()
    })

    it('rejects missing identifiers before database access', async () => {
      await expect(
        assertCanChatWithMemory(
          '',
          memoryId,
        ),
      ).rejects.toThrow(
        'User ID must be a non-empty string.',
      )

      await expect(
        assertCanChatWithMemory(
          memberId,
          '',
        ),
      ).rejects.toThrow(
        'Memory ID must be a non-empty string.',
      )

      expect(
        mocks.findMemoryProfile,
      ).not.toHaveBeenCalled()
    })
  })
