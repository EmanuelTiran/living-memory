import request from 'supertest'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { AppError } from '../src/errors/AppError.js'

const mocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  chatMessageRateLimiter: vi.fn(),
  createMemoryChatConversation: vi.fn(),
  getMemoryChatHistory: vi.fn(),
  sendMemoryChatMessage: vi.fn(),
}))

vi.mock(
  '../src/modules/auth/tokens.js',
  () => ({
    verifyAccessToken:
      mocks.verifyAccessToken,
  }),
)

vi.mock(
  '../src/modules/chat/chatRateLimiter.js',
  () => ({
    chatMessageRateLimiter:
      mocks.chatMessageRateLimiter,
  }),
)

vi.mock(
  '../src/modules/chat/chatService.js',
  () => ({
    createMemoryChatConversation:
      mocks.createMemoryChatConversation,

    getMemoryChatHistory:
      mocks.getMemoryChatHistory,

    sendMemoryChatMessage:
      mocks.sendMemoryChatMessage,
  }),
)

import app from '../src/app.js'

const userId =
  '507f1f77bcf86cd799439010'

const memoryId =
  '507f1f77bcf86cd799439011'

const conversationId =
  '507f1f77bcf86cd799439012'

const beforeMessageId =
  '507f1f77bcf86cd799439013'

const userMessageId =
  '507f1f77bcf86cd799439014'

const assistantMessageId =
  '507f1f77bcf86cd799439015'

const authentication = {
  userId,
  systemRole: 'user',
  tokenId: 'token-id',
  expiresAt: new Date(
    Date.now() + 15 * 60 * 1000,
  ),
}

const conversation = {
  id: conversationId,
  memoryId,
  participantUserId: userId,
  status: 'active',
  lastMessageAt: null,
  createdAt:
    '2026-07-27T18:00:00.000Z',
  updatedAt:
    '2026-07-27T18:00:00.000Z',
}

const userMessage = {
  id: userMessageId,
  conversationId,
  memoryId,
  participantUserId: userId,
  role: 'user',
  content: 'במה שרה עבדה?',
  groundingStatus: 'not_applicable',
  citations: [],
  createdAt:
    '2026-07-27T18:01:00.000Z',
}

const assistantMessage = {
  id: assistantMessageId,
  conversationId,
  memoryId,
  participantUserId: userId,
  role: 'assistant',
  content:
    'שרה עבדה כמורה בבית ספר.',
  groundingStatus: 'grounded',
  citations: [
    {
      sourceType: 'memory_story',
      sourceId:
        '507f1f77bcf86cd799439016',
      title: 'המקצוע של שרה',
      excerpt:
        'שרה עבדה כמורה בבית ספר.',
      approvedAt: null,
      sourceVersion:
        '2026-07-27T17:00:00.000Z',
    },
  ],
  createdAt:
    '2026-07-27T18:01:01.000Z',
}

function authenticateRequest() {
  mocks.verifyAccessToken.mockResolvedValue(
    authentication,
  )
}

beforeEach(() => {
  vi.resetAllMocks()

  mocks.chatMessageRateLimiter
    .mockImplementation(
      (_req, _res, next) => {
        next()
      },
    )
})

describe('Chat routes', () => {
  it('creates a conversation for an authenticated user', async () => {
    authenticateRequest()

    mocks.createMemoryChatConversation
      .mockResolvedValue(conversation)

    const response = await request(app)
      .post(
        `/api/memories/${memoryId}/chat/conversations`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )

    expect(response.status).toBe(201)

    expect(
      mocks.createMemoryChatConversation,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
    )

    expect(response.body).toEqual({
      success: true,
      data: {
        conversation,
      },
    })
  })

  it('sends a validated message and returns the exchange', async () => {
    authenticateRequest()

    const chatExchange = {
      conversation: {
        ...conversation,
        lastMessageAt:
          assistantMessage.createdAt,
      },
      userMessage,
      assistantMessage,
    }

    mocks.sendMemoryChatMessage
      .mockResolvedValue(chatExchange)

    const response = await request(app)
      .post(
        `/api/memories/${memoryId}/chat/conversations/${conversationId}/messages`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )
      .send({
        message:
          '  במה שרה עבדה?  ',
      })

    expect(response.status).toBe(201)

    expect(
      mocks.chatMessageRateLimiter,
    ).toHaveBeenCalledTimes(1)

    expect(
      mocks.sendMemoryChatMessage,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
      conversationId,
      {
        message: 'במה שרה עבדה?',
      },
    )

    expect(response.body).toEqual({
      success: true,
      data: chatExchange,
    })
  })

  it('returns validated paginated conversation history', async () => {
    authenticateRequest()

    const history = {
      conversation,
      messages: [
        userMessage,
        assistantMessage,
      ],
      pagination: {
        limit: 2,
        hasMore: true,
        nextBeforeMessageId:
          userMessageId,
      },
    }

    mocks.getMemoryChatHistory
      .mockResolvedValue(history)

    const response = await request(app)
      .get(
        `/api/memories/${memoryId}/chat/conversations/${conversationId}/messages`,
      )
      .query({
        limit: '2',
        beforeMessageId,
      })
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )

    expect(response.status).toBe(200)

    expect(
      mocks.getMemoryChatHistory,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
      conversationId,
      {
        limit: 2,
        beforeMessageId,
      },
    )

    expect(response.body).toEqual({
      success: true,
      data: history,
    })
  })

  it('requires authentication before accessing chat', async () => {
    const response = await request(app)
      .post(
        `/api/memories/${memoryId}/chat/conversations`,
      )

    expect(response.status).toBe(401)

    expect(
      mocks.createMemoryChatConversation,
    ).not.toHaveBeenCalled()

    expect(
      mocks.sendMemoryChatMessage,
    ).not.toHaveBeenCalled()

    expect(
      mocks.getMemoryChatHistory,
    ).not.toHaveBeenCalled()
  })

  it('rejects invalid route and query parameters', async () => {
    authenticateRequest()

    const invalidMemoryResponse =
      await request(app)
        .post(
          '/api/memories/invalid-memory-id/chat/conversations',
        )
        .set(
          'Authorization',
          'Bearer valid-access-token',
        )

    expect(
      invalidMemoryResponse.status,
    ).toBe(400)

    expect(
      invalidMemoryResponse.body.error,
    ).toMatchObject({
      code: 'VALIDATION_ERROR',
      message:
        'Request validation failed.',
      requestId: expect.any(String),
    })

    const invalidQueryResponse =
      await request(app)
        .get(
          `/api/memories/${memoryId}/chat/conversations/${conversationId}/messages`,
        )
        .query({
          limit: 101,
        })
        .set(
          'Authorization',
          'Bearer valid-access-token',
        )

    expect(
      invalidQueryResponse.status,
    ).toBe(400)

    expect(
      invalidQueryResponse.body.error,
    ).toMatchObject({
      code: 'VALIDATION_ERROR',
      message:
        'Request validation failed.',
      requestId: expect.any(String),
    })

    expect(
      mocks.createMemoryChatConversation,
    ).not.toHaveBeenCalled()

    expect(
      mocks.getMemoryChatHistory,
    ).not.toHaveBeenCalled()
  })

  it('rejects empty and oversized messages', async () => {
    authenticateRequest()

    const invalidMessages = [
      '   ',
      'a'.repeat(2001),
    ]

    for (const message of invalidMessages) {
      const response = await request(app)
        .post(
          `/api/memories/${memoryId}/chat/conversations/${conversationId}/messages`,
        )
        .set(
          'Authorization',
          'Bearer valid-access-token',
        )
        .send({
          message,
        })

      expect(response.status).toBe(400)

      expect(
        response.body.error,
      ).toMatchObject({
        code: 'VALIDATION_ERROR',
        message:
          'Request validation failed.',
        requestId: expect.any(String),
      })
    }

    expect(
      mocks.sendMemoryChatMessage,
    ).not.toHaveBeenCalled()
  })

  it('returns a safe response when the memory is unavailable', async () => {
    authenticateRequest()

    mocks.createMemoryChatConversation
      .mockRejectedValue(
        new AppError(
          'Memory profile was not found.',
          {
            statusCode: 404,
            code: 'MEMORY_NOT_FOUND',
          },
        ),
      )

    const response = await request(app)
      .post(
        `/api/memories/${memoryId}/chat/conversations`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )

    expect(response.status).toBe(404)

    expect(response.body.error)
      .toMatchObject({
        code: 'MEMORY_NOT_FOUND',
        message:
          'Memory profile was not found.',
        requestId: expect.any(String),
      })
  })

  it('returns a safe response when OpenAI is unavailable', async () => {
    authenticateRequest()

    mocks.sendMemoryChatMessage
      .mockRejectedValue(
        new AppError(
          'The AI service is temporarily unavailable.',
          {
            statusCode: 502,
            code: 'AI_PROVIDER_ERROR',
          },
        ),
      )

    const response = await request(app)
      .post(
        `/api/memories/${memoryId}/chat/conversations/${conversationId}/messages`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )
      .send({
        message: 'במה שרה עבדה?',
      })

    expect(response.status).toBe(502)

    expect(response.body.error)
      .toMatchObject({
        code: 'AI_PROVIDER_ERROR',
        message:
          'The AI service is temporarily unavailable.',
        requestId: expect.any(String),
      })
  })
})