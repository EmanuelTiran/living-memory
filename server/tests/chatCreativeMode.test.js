import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
  } from 'vitest'

  const mocks = vi.hoisted(() => ({
    assertCanChatWithMemory: vi.fn(),
    buildChatContext: vi.fn(),
    generateGroundedChatReply: vi.fn(),

    ChatConversation: {
      findOne: vi.fn(),
      updateOne: vi.fn(),
    },

    ChatMessage: {
      create: vi.fn(),
      find: vi.fn(),
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
    sendMemoryChatMessage,
  } from '../src/modules/chat/chatService.js'

  const userId =
    '507f1f77bcf86cd799439010'

  const memoryId =
    '507f1f77bcf86cd799439011'

  const conversationId =
    '507f1f77bcf86cd799439012'

  const userMessageId =
    '507f1f77bcf86cd799439013'

  const assistantMessageId =
    '507f1f77bcf86cd799439014'

  const messageCreatedAt =
    new Date(
      '2026-07-28T10:00:00.000Z',
    )

  const creativeReply = {
    content:
      'בהדמיה יצירתית אפשר לדמיין שהיא הייתה בוחרת בכחול.',
    groundingStatus: 'creative',
    citations: [],
    provider: 'openai',
    model: 'gpt-5.6-terra',
    providerResponseId:
      'resp_creative_test',
  }

  function createDocument(values) {
    return {
      ...values,

      toJSON: vi.fn(() => {
        const publicValues = {
          ...values,
        }

        delete publicValues._id

        return {
          ...publicValues,
          id: values._id.toString(),
        }
      }),
    }
  }

  function createHistoryQuery(result = []) {
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

  beforeEach(() => {
    vi.resetAllMocks()

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

    mocks.ChatConversation.findOne
      .mockResolvedValue(
        createDocument({
          _id: conversationId,
          memoryId,
          participantUserId: userId,
          status: 'active',
          lastMessageAt:
            messageCreatedAt,
        }),
      )

    mocks.ChatConversation.updateOne
      .mockResolvedValue({
        acknowledged: true,
        matchedCount: 1,
        modifiedCount: 1,
      })

    mocks.ChatMessage.find
      .mockReturnValue(
        createHistoryQuery([]),
      )

    mocks.buildChatContext
      .mockResolvedValue({
        groundingStatus:
          'insufficient_context',
        message:
          'מה היה הצבע האהוב עליה?',
        sources: [],
        fallbackResponse:
          'אין מספיק מידע.',
      })

    mocks.generateGroundedChatReply
      .mockResolvedValue(
        creativeReply,
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
                  messageCreatedAt,
              }),
          ),
      )
  })

  describe('Creative chat mode', () => {
    it('generates and persists an explicitly requested creative reply', async () => {
      const result =
        await sendMemoryChatMessage(
          userId,
          memoryId,
          conversationId,
          {
            message:
              '  מה היה הצבע האהוב עליה?  ',
            responseMode: 'creative',
          },
        )

      expect(
        mocks.assertCanChatWithMemory,
      ).toHaveBeenCalledWith(
        userId,
        memoryId,
      )

      expect(
        mocks.generateGroundedChatReply,
      ).toHaveBeenCalledWith({
        userId,
        message:
          'מה היה הצבע האהוב עליה?',
        sources: [],
        history: [],
        responseMode: 'creative',
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
            'מה היה הצבע האהוב עליה?',
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
            creativeReply.content,
          groundingStatus: 'creative',
          citations: [],
        },
      ])

      expect(result).toMatchObject({
        userMessage: {
          id: userMessageId,
          role: 'user',
        },
        assistantMessage: {
          id: assistantMessageId,
          role: 'assistant',
          groundingStatus: 'creative',
          citations: [],
        },
      })
    })

    it('rejects an unsupported response mode before authorization and database access', async () => {
      await expect(
        sendMemoryChatMessage(
          userId,
          memoryId,
          conversationId,
          {
            message: 'Valid message',
            responseMode: 'fantasy',
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

      expect(
        mocks.generateGroundedChatReply,
      ).not.toHaveBeenCalled()

      expect(
        mocks.ChatMessage.create,
      ).not.toHaveBeenCalled()
    })
  })
