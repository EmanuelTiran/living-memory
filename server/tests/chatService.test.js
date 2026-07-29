import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
  } from 'vitest'
  import { AppError } from '../src/errors/AppError.js'

  const mocks = vi.hoisted(() => ({
    assertCanChatWithMemory: vi.fn(),
    buildChatContext: vi.fn(),
    generateGroundedChatReply: vi.fn(),

    ChatConversation: {
      create: vi.fn(),
      findOne: vi.fn(),
      updateOne: vi.fn(),
    },

    ChatMessage: {
      create: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
    },
  }))

  vi.mock(
    '../src/modules/memories/memoryAccessService.js',
    () => ({
      assertCanChatWithMemory:
        mocks.assertCanChatWithMemory,
    }),
  )

  vi.mock(
    '../src/modules/chat/chatContextService.js',
    () => ({
      buildChatContext:
        mocks.buildChatContext,
    }),
  )

  vi.mock(
    '../src/modules/chat/openaiChatProvider.js',
    () => ({
      generateGroundedChatReply:
        mocks.generateGroundedChatReply,
    }),
  )

  vi.mock(
    '../src/modules/chat/ChatConversation.js',
    () => ({
      default: mocks.ChatConversation,
    }),
  )

  vi.mock(
    '../src/modules/chat/ChatMessage.js',
    () => ({
      default: mocks.ChatMessage,
    }),
  )

  import {
    createMemoryChatConversation,
    getMemoryChatHistory,
    sendMemoryChatMessage,
  } from '../src/modules/chat/chatService.js'

  const userId =
    '507f1f77bcf86cd799439010'

  const memoryId =
    '507f1f77bcf86cd799439011'

  const conversationId =
    '507f1f77bcf86cd799439012'

  const sourceId =
    '507f1f77bcf86cd799439013'

  const userMessageId =
    '507f1f77bcf86cd799439014'

  const assistantMessageId =
    '507f1f77bcf86cd799439015'

  const userMessageCreatedAt =
    new Date(
      '2026-07-27T10:00:01.000Z',
    )

  const assistantMessageCreatedAt =
    new Date(
      '2026-07-27T10:00:02.000Z',
    )

  const approvedSource = {
    sourceType: 'memory_story',
    sourceId,
    title: 'המקצוע של שרה',
    content:
      'שרה עבדה כמורה בבית ספר.',
    approvedAt: null,
    sourceVersion:
      '2026-07-27T09:00:00.000Z',
  }

  const groundedReply = {
    content:
      'שרה עבדה כמורה בבית ספר.',
    groundingStatus: 'grounded',
    citations: [
      {
        sourceType: 'memory_story',
        sourceId,
        title: 'המקצוע של שרה',
        excerpt:
          'שרה עבדה כמורה בבית ספר.',
        approvedAt: null,
        sourceVersion:
          '2026-07-27T09:00:00.000Z',
      },
    ],
    provider: 'openai',
    model: 'gpt-5.6-terra',
    providerResponseId:
      'resp_test_grounded',
  }

  function createDocument(values) {
    return {
      ...values,

      toJSON: vi.fn(() => {
        const {
          _id,
          ...publicValues
        } = values

        return {
          ...publicValues,
          id: _id.toString(),
        }
      }),
    }
  }

  function createQuery(result) {
    const query = {
      sort: vi.fn(),
      limit: vi.fn(),
      select: vi.fn(),
      lean: vi.fn(),
    }

    query.sort.mockReturnValue(query)
    query.limit.mockReturnValue(query)
    query.select.mockReturnValue(query)
    query.lean.mockResolvedValue(result)

    return query
  }

  let conversationDocument

  beforeEach(() => {
    vi.resetAllMocks()

    conversationDocument =
      createDocument({
        _id: conversationId,
        memoryId,
        participantUserId: userId,
        status: 'active',
        lastMessageAt:
          userMessageCreatedAt,
      })

    mocks.assertCanChatWithMemory
      .mockResolvedValue({
        memoryProfile: {
          id: memoryId,
        },
        authorization: {
          role: 'owner',
          permission: 'chat',
          accessType: 'owner',
        },
      })

    mocks.ChatConversation.create
      .mockResolvedValue(
        conversationDocument,
      )

    mocks.ChatConversation.findOne
      .mockResolvedValue(
        conversationDocument,
      )

    mocks.ChatConversation.updateOne
      .mockResolvedValue({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 1,
      })

    mocks.ChatMessage.find
      .mockReturnValue(
        createQuery([]),
      )

    mocks.ChatMessage.findOne
      .mockReturnValue(
        createQuery(null),
      )

    mocks.buildChatContext
      .mockResolvedValue({
        groundingStatus: 'grounded',
        message: 'במה שרה עבדה?',
        sources: [approvedSource],
        fallbackResponse: null,
      })

    mocks.generateGroundedChatReply
      .mockResolvedValue(
        groundedReply,
      )

    mocks.ChatMessage.create
      .mockImplementation(
        async (definitions) =>
          definitions.map(
            (definition, index) =>
              createDocument({
                ...definition,
                _id:
                  index === 0
                    ? userMessageId
                    : assistantMessageId,
                createdAt:
                  index === 0
                    ? userMessageCreatedAt
                    : assistantMessageCreatedAt,
              }),
          ),
      )
  })

  describe('Chat service', () => {
    it('creates a conversation for an authorized user', async () => {
      const result =
        await createMemoryChatConversation(
          userId,
          memoryId,
        )

      expect(
        mocks.assertCanChatWithMemory,
      ).toHaveBeenCalledWith(
        userId,
        memoryId,
      )

      expect(
        mocks.ChatConversation.create,
      ).toHaveBeenCalledWith({
        memoryId,
        participantUserId: userId,
        status: 'active',
      })

      expect(result).toMatchObject({
        id: conversationId,
        memoryId,
        participantUserId: userId,
        status: 'active',
      })
    })

    it('stops before creating a conversation when access is denied', async () => {
      mocks.assertCanChatWithMemory
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
        createMemoryChatConversation(
          userId,
          memoryId,
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'MEMORY_NOT_FOUND',
      })

      expect(
        mocks.ChatConversation.create,
      ).not.toHaveBeenCalled()
    })

    it('generates and persists a grounded exchange', async () => {
      const historyQuery =
        createQuery([
          {
            role: 'assistant',
            content:
              'תשובה קודמת.',
          },
          {
            role: 'user',
            content:
              'שאלה קודמת.',
          },
        ])

      mocks.ChatMessage.find
        .mockReturnValueOnce(
          historyQuery,
        )

      const result =
        await sendMemoryChatMessage(
          userId,
          memoryId,
          conversationId,
          {
            message:
              '  במה שרה עבדה?  ',
          },
        )

      expect(
        mocks.ChatConversation.findOne,
      ).toHaveBeenCalledWith({
        _id: conversationId,
        memoryId,
        participantUserId: userId,
        status: 'active',
      })

      expect(
        mocks.buildChatContext,
      ).toHaveBeenCalledWith({
        memoryId,
        message:
          'במה שרה עבדה?',
      })

      expect(
        mocks.generateGroundedChatReply,
      ).toHaveBeenCalledWith({
        userId,
        message:
          'במה שרה עבדה?',
        sources: [approvedSource],
        history: [
          {
            role: 'user',
            content:
              'שאלה קודמת.',
          },
          {
            role: 'assistant',
            content:
              'תשובה קודמת.',
          },
        ],
      })

      expect(
        mocks.ChatMessage.create,
      ).toHaveBeenCalledWith([
        {
          conversationId,
          memoryId,
          participantUserId: userId,
          role: 'user',
          content:
            'במה שרה עבדה?',
          groundingStatus:
            'not_applicable',
          citations: [],
        },
        {
          conversationId,
          memoryId,
          participantUserId: userId,
          role: 'assistant',
          content:
            groundedReply.content,
          groundingStatus:
            'grounded',
          citations:
            groundedReply.citations,
        },
      ])

      expect(
        mocks.ChatConversation.updateOne,
      ).toHaveBeenCalledWith(
        {
          _id: conversationId,
          memoryId,
          participantUserId: userId,
          status: 'active',
        },
        {
          $set: {
            lastMessageAt:
              assistantMessageCreatedAt,
          },
        },
      )

      expect(result).toMatchObject({
        conversation: {
          id: conversationId,
          lastMessageAt:
            assistantMessageCreatedAt,
        },
        userMessage: {
          id: userMessageId,
          role: 'user',
          content:
            'במה שרה עבדה?',
        },
        assistantMessage: {
          id: assistantMessageId,
          role: 'assistant',
          content:
            groundedReply.content,
          groundingStatus: 'grounded',
        },
      })
    })

    it('persists the standard fallback when context is insufficient', async () => {
      const insufficientReply = {
        content:
          'אין בזיכרונות המאושרים מספיק מידע כדי לענות על השאלה הזאת.',
        groundingStatus:
          'insufficient_context',
        citations: [],
        provider: 'local_policy',
        model: null,
        providerResponseId: null,
      }

      mocks.buildChatContext
        .mockResolvedValue({
          groundingStatus:
            'insufficient_context',
          message:
            'מה היה הצבע האהוב עליה?',
          sources: [],
          fallbackResponse:
            insufficientReply.content,
        })

      mocks.generateGroundedChatReply
        .mockResolvedValue(
          insufficientReply,
        )

      await sendMemoryChatMessage(
        userId,
        memoryId,
        conversationId,
        {
          message:
            'מה היה הצבע האהוב עליה?',
        },
      )

      expect(
        mocks.generateGroundedChatReply,
      ).toHaveBeenCalledWith({
        userId,
        message:
          'מה היה הצבע האהוב עליה?',
        sources: [],
        history: [],
      })

      const savedDefinitions =
        mocks.ChatMessage.create
          .mock.calls[0][0]

      expect(
        savedDefinitions[1],
      ).toMatchObject({
        role: 'assistant',
        content:
          insufficientReply.content,
        groundingStatus:
          'insufficient_context',
        citations: [],
      })
    })

    it('does not persist messages when OpenAI fails', async () => {
      mocks.generateGroundedChatReply
        .mockRejectedValue(
          new AppError(
            'The AI service is temporarily unavailable.',
            {
              statusCode: 502,
              code: 'AI_PROVIDER_ERROR',
            },
          ),
        )

      await expect(
        sendMemoryChatMessage(
          userId,
          memoryId,
          conversationId,
          {
            message:
              'במה שרה עבדה?',
          },
        ),
      ).rejects.toMatchObject({
        statusCode: 502,
        code: 'AI_PROVIDER_ERROR',
      })

      expect(
        mocks.ChatMessage.create,
      ).not.toHaveBeenCalled()

      expect(
        mocks.ChatConversation.updateOne,
      ).not.toHaveBeenCalled()
    })

    it('validates empty and oversized messages before database access', async () => {
      await expect(
        sendMemoryChatMessage(
          userId,
          memoryId,
          conversationId,
          {
            message: '   ',
          },
        ),
      ).rejects.toMatchObject({
        name: 'ZodError',
      })

      await expect(
        sendMemoryChatMessage(
          userId,
          memoryId,
          conversationId,
          {
            message:
              'a'.repeat(2001),
          },
        ),
      ).rejects.toMatchObject({
        name: 'ZodError',
      })

      expect(
        mocks.assertCanChatWithMemory,
      ).not.toHaveBeenCalled()

      expect(
        mocks.ChatConversation.findOne,
      ).not.toHaveBeenCalled()
    })

    it('returns a safe error for an unavailable conversation', async () => {
      mocks.ChatConversation.findOne
        .mockResolvedValue(null)

      await expect(
        sendMemoryChatMessage(
          userId,
          memoryId,
          conversationId,
          {
            message:
              'במה שרה עבדה?',
          },
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code:
          'CHAT_CONVERSATION_NOT_FOUND',
        message:
          'Chat conversation was not found.',
      })

      expect(
        mocks.buildChatContext,
      ).not.toHaveBeenCalled()

      expect(
        mocks.generateGroundedChatReply,
      ).not.toHaveBeenCalled()
    })

    it('returns paginated history in chronological order', async () => {
      const oldestMessageId =
        '507f1f77bcf86cd799439016'

      const middleMessageId =
        '507f1f77bcf86cd799439017'

      const newestMessageId =
        '507f1f77bcf86cd799439018'

      const historyQuery =
        createQuery([
          {
            _id: newestMessageId,
            conversationId,
            memoryId,
            participantUserId: userId,
            role: 'assistant',
            content: 'Newest message.',
            groundingStatus: 'grounded',
            citations: [
              groundedReply.citations[0],
            ],
            createdAt:
              new Date(
                '2026-07-27T10:00:03.000Z',
              ),
          },
          {
            _id: middleMessageId,
            conversationId,
            memoryId,
            participantUserId: userId,
            role: 'user',
            content: 'Middle message.',
            groundingStatus:
              'not_applicable',
            citations: [],
            createdAt:
              new Date(
                '2026-07-27T10:00:02.000Z',
              ),
          },
          {
            _id: oldestMessageId,
            conversationId,
            memoryId,
            participantUserId: userId,
            role: 'user',
            content: 'Oldest message.',
            groundingStatus:
              'not_applicable',
            citations: [],
            createdAt:
              new Date(
                '2026-07-27T10:00:01.000Z',
              ),
          },
        ])

      mocks.ChatMessage.find
        .mockReturnValueOnce(
          historyQuery,
        )

      const result =
        await getMemoryChatHistory(
          userId,
          memoryId,
          conversationId,
          {
            limit: 2,
          },
        )

      expect(
        historyQuery.limit,
      ).toHaveBeenCalledWith(3)

      expect(
        result.messages.map(
          (message) => message.id,
        ),
      ).toEqual([
        middleMessageId,
        newestMessageId,
      ])

      expect(result.pagination).toEqual({
        limit: 2,
        hasMore: true,
        nextBeforeMessageId:
          middleMessageId,
      })
    })

    it('rejects a history cursor outside the conversation', async () => {
      const invalidCursorId =
        '507f1f77bcf86cd799439019'

      const cursorQuery =
        createQuery(null)

      mocks.ChatMessage.findOne
        .mockReturnValueOnce(
          cursorQuery,
        )

      await expect(
        getMemoryChatHistory(
          userId,
          memoryId,
          conversationId,
          {
            limit: 20,
            beforeMessageId:
              invalidCursorId,
          },
        ),
      ).rejects.toMatchObject({
        statusCode: 400,
        code:
          'INVALID_CHAT_HISTORY_CURSOR',
        message:
          'Chat history cursor is invalid.',
      })

      expect(
        mocks.ChatMessage.find,
      ).not.toHaveBeenCalled()
    })
  })
