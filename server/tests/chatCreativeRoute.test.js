import request from 'supertest'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

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

const authentication = {
  userId,
  systemRole: 'user',
  tokenId: 'token-id',
  expiresAt: new Date(
    Date.now() + 15 * 60 * 1000,
  ),
}

const chatExchange = {
  conversation: {
    id: conversationId,
    memoryId,
    participantUserId: userId,
    status: 'active',
  },

  userMessage: {
    id:
      '507f1f77bcf86cd799439013',
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

  assistantMessage: {
    id:
      '507f1f77bcf86cd799439014',
    conversationId,
    memoryId,
    participantUserId: userId,
    role: 'assistant',
    content:
      'בהדמיה יצירתית אפשר לדמיין שהיא הייתה בוחרת בכחול.',
    groundingStatus: 'creative',
    citations: [],
  },
}

beforeEach(() => {
  vi.resetAllMocks()

  mocks.verifyAccessToken
    .mockResolvedValue(
      authentication,
    )

  mocks.chatMessageRateLimiter
    .mockImplementation(
      (_req, _res, next) => {
        next()
      },
    )

  mocks.sendMemoryChatMessage
    .mockResolvedValue(
      chatExchange,
    )
})

describe('Creative chat route', () => {
  it('accepts an explicit creative response request', async () => {
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
          '  מה היה הצבע האהוב עליה?  ',
        responseMode: 'creative',
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
        message:
          'מה היה הצבע האהוב עליה?',
        responseMode: 'creative',
      },
    )

    expect(
      response.body,
    ).toEqual({
      success: true,
      data: chatExchange,
    })
  })

  it('rejects an unsupported response mode', async () => {
    const response = await request(app)
      .post(
        `/api/memories/${memoryId}/chat/conversations/${conversationId}/messages`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )
      .send({
        message: 'Valid message',
        responseMode: 'automatic',
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

    expect(
      mocks.sendMemoryChatMessage,
    ).not.toHaveBeenCalled()
  })
})
