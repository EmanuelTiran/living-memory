import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
  } from 'vitest'
  import { AppError } from '../src/errors/AppError.js'

  const mocks = vi.hoisted(() => ({
    requireMemoryPermission: vi.fn(),

    ChatMessage: {
      exists: vi.fn(),
    },

    MemoryBiographyAnswer: {
      exists: vi.fn(),
      create: vi.fn(),
    },
  }))

  vi.mock(
    '../src/modules/memories/memoryAccessService.js',
    () => ({
      MEMORY_PERMISSIONS: {
        MANAGE: 'manage',
      },

      requireMemoryPermission:
        mocks.requireMemoryPermission,
    }),
  )

  vi.mock(
    '../src/modules/chat/ChatMessage.js',
    () => ({
      default: mocks.ChatMessage,
    }),
  )

  vi.mock(
    '../src/modules/memories/MemoryBiographyAnswer.js',
    () => ({
      default:
        mocks.MemoryBiographyAnswer,

      BIOGRAPHY_QUESTION_MAX_LENGTH:
        300,

      BIOGRAPHY_ANSWER_MAX_LENGTH:
        4000,
    }),
  )

  import {
    promoteCreativeChatReply,
  } from '../src/modules/memories/biographyService.js'

  const userId =
    '507f1f77bcf86cd799439010'

  const memoryId =
    '507f1f77bcf86cd799439011'

  const messageId =
    '507f1f77bcf86cd799439012'

  const biographyAnswerId =
    '507f1f77bcf86cd799439013'

  function createBiographyDocument(values) {
    return {
      ...values,

      toJSON: vi.fn(() => ({
        ...values,
        id: biographyAnswerId,
      })),
    }
  }

  beforeEach(() => {
    vi.resetAllMocks()

    mocks.requireMemoryPermission
      .mockResolvedValue({
        memoryProfile: {
          id: memoryId,
        },
        authorization: {
          role: 'owner',
          permission: 'manage',
          accessType: 'owner',
        },
      })

    mocks.ChatMessage.exists
      .mockResolvedValue({
        _id: messageId,
      })

    mocks.MemoryBiographyAnswer.exists
      .mockResolvedValue(null)

    mocks.MemoryBiographyAnswer.create
      .mockImplementation(
        async (values) =>
          createBiographyDocument(values),
      )
  })

  describe('Biography service', () => {
    it('promotes a verified creative message to an approved biography source', async () => {
      const result =
        await promoteCreativeChatReply(
          userId,
          memoryId,
          messageId,
          {
            question:
              '  What was her favorite color?  ',
            answer:
              '  She preferred blue.  ',
          },
        )

      expect(
        mocks.requireMemoryPermission,
      ).toHaveBeenCalledWith(
        userId,
        memoryId,
        'manage',
      )

      expect(
        mocks.ChatMessage.exists,
      ).toHaveBeenCalledWith({
        _id: messageId,
        memoryId,
        participantUserId: userId,
        role: 'assistant',
        groundingStatus: 'creative',
      })

      expect(
        mocks.MemoryBiographyAnswer.create,
      ).toHaveBeenCalledWith({
        memoryId,
        createdByUserId: userId,
        question:
          'What was her favorite color?',
        answer:
          'She preferred blue.',
        origin: 'creative_chat',
        sourceChatMessageId: messageId,
        status: 'approved',
        approvedAt: expect.any(Date),
        approvedByUserId: userId,
        revision: 1,
      })

      expect(result).toMatchObject({
        id: biographyAnswerId,
        memoryId,
        createdByUserId: userId,
        question:
          'What was her favorite color?',
        answer:
          'She preferred blue.',
        origin: 'creative_chat',
        sourceChatMessageId: messageId,
        status: 'approved',
        approvedByUserId: userId,
        revision: 1,
      })
    })

    it('stops before reading chat data when manage permission is denied', async () => {
      mocks.requireMemoryPermission
        .mockRejectedValue(
          new AppError(
            'Memory profile was not found.',
            {
              statusCode: 404,
              code: 'MEMORY_NOT_FOUND',
            },
          ),
        )

      await expect(
        promoteCreativeChatReply(
          userId,
          memoryId,
          messageId,
          {
            question:
              'What was her favorite color?',
            answer:
              'She preferred blue.',
          },
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'MEMORY_NOT_FOUND',
      })

      expect(
        mocks.ChatMessage.exists,
      ).not.toHaveBeenCalled()

      expect(
        mocks.MemoryBiographyAnswer.create,
      ).not.toHaveBeenCalled()
    })

    it('rejects a message that is not an owned creative assistant reply', async () => {
      mocks.ChatMessage.exists
        .mockResolvedValue(null)

      await expect(
        promoteCreativeChatReply(
          userId,
          memoryId,
          messageId,
          {
            question:
              'What was her favorite color?',
            answer:
              'She preferred blue.',
          },
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code:
          'CREATIVE_CHAT_MESSAGE_NOT_FOUND',
        message:
          'Creative chat message was not found.',
      })

      expect(
        mocks.MemoryBiographyAnswer.exists,
      ).not.toHaveBeenCalled()

      expect(
        mocks.MemoryBiographyAnswer.create,
      ).not.toHaveBeenCalled()
    })

    it('rejects a duplicate promoted message', async () => {
      mocks.MemoryBiographyAnswer.exists
        .mockResolvedValue({
          _id: biographyAnswerId,
        })

      await expect(
        promoteCreativeChatReply(
          userId,
          memoryId,
          messageId,
          {
            question:
              'What was her favorite color?',
            answer:
              'She preferred blue.',
          },
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code:
          'BIOGRAPHY_SOURCE_EXISTS',
      })

      expect(
        mocks.MemoryBiographyAnswer.create,
      ).not.toHaveBeenCalled()
    })

    it('handles a duplicate-key race safely', async () => {
      const duplicateError =
        new Error('Duplicate key')

      duplicateError.code = 11000

      mocks.MemoryBiographyAnswer.create
        .mockRejectedValue(
          duplicateError,
        )

      await expect(
        promoteCreativeChatReply(
          userId,
          memoryId,
          messageId,
          {
            question:
              'What was her favorite color?',
            answer:
              'She preferred blue.',
          },
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code:
          'BIOGRAPHY_SOURCE_EXISTS',
      })
    })

    it('validates input before authorization or database access', async () => {
      await expect(
        promoteCreativeChatReply(
          userId,
          memoryId,
          messageId,
          {
            question: ' ',
            answer: ' ',
          },
        ),
      ).rejects.toMatchObject({
        name: 'ZodError',
      })

      expect(
        mocks.requireMemoryPermission,
      ).not.toHaveBeenCalled()

      expect(
        mocks.ChatMessage.exists,
      ).not.toHaveBeenCalled()

      expect(
        mocks.MemoryBiographyAnswer.create,
      ).not.toHaveBeenCalled()
    })
  })
