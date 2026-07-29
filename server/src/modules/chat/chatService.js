import { AppError } from '../../errors/AppError.js'
import {
  assertCanChatWithMemory,
} from '../memories/memoryAccessService.js'
import ChatConversation from './ChatConversation.js'
import ChatMessage from './ChatMessage.js'
import {
  buildChatContext,
} from './chatContextService.js'
import {
  MAX_CHAT_PROMPT_HISTORY_MESSAGES,
} from './memoryChatPrompt.js'
import {
  generateGroundedChatReply,
} from './openaiChatProvider.js'
import {
  chatConversationParamsSchema,
  chatHistoryQuerySchema,
  chatMemoryParamsSchema,
  sendChatMessageSchema,
} from './validation.js'

const ACTIVE_CONVERSATION_STATUS = 'active'

function validateUserId(userId) {
  if (
    typeof userId !== 'string' ||
    userId.length === 0
  ) {
    throw new TypeError(
      'User ID must be a non-empty string.',
    )
  }
}

function createConversationNotFoundError() {
  return new AppError(
    'Chat conversation was not found.',
    {
      statusCode: 404,
      code: 'CHAT_CONVERSATION_NOT_FOUND',
    },
  )
}

function createInvalidHistoryCursorError() {
  return new AppError(
    'Chat history cursor is invalid.',
    {
      statusCode: 400,
      code: 'INVALID_CHAT_HISTORY_CURSOR',
    },
  )
}

function serializeRecord(record) {
  if (!record) {
    return record
  }

  if (typeof record.toJSON === 'function') {
    return record.toJSON()
  }

  const serializedRecord = {
    ...record,
  }

  if (serializedRecord._id) {
    serializedRecord.id =
      serializedRecord._id.toString()

    delete serializedRecord._id
  }

  return serializedRecord
}

function parseMemoryId(memoryId) {
  return chatMemoryParamsSchema.parse({
    memoryId,
  }).memoryId
}

function parseConversationIdentifiers(
  memoryId,
  conversationId,
) {
  return chatConversationParamsSchema.parse({
    memoryId,
    conversationId,
  })
}

function createConversationFilter(
  userId,
  memoryId,
  conversationId,
) {
  return {
    _id: conversationId,
    memoryId,
    participantUserId: userId,
    status: ACTIVE_CONVERSATION_STATUS,
  }
}

async function findActiveConversation(
  userId,
  memoryId,
  conversationId,
) {
  const conversation =
    await ChatConversation.findOne(
      createConversationFilter(
        userId,
        memoryId,
        conversationId,
      ),
    )

  if (!conversation) {
    throw createConversationNotFoundError()
  }

  return conversation
}

async function loadPromptHistory(
  userId,
  memoryId,
  conversationId,
) {
  const recentMessages =
    await ChatMessage.find({
      conversationId,
      memoryId,
      participantUserId: userId,
    })
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .limit(
        MAX_CHAT_PROMPT_HISTORY_MESSAGES,
      )
      .select({
        _id: 0,
        role: 1,
        content: 1,
      })
      .lean()

  return recentMessages
    .reverse()
    .map((message) => ({
      role: message.role,
      content: message.content,
    }))
}

async function persistChatExchange({
  conversation,
  userId,
  memoryId,
  message,
  reply,
}) {
  const createdMessages =
    await ChatMessage.create([
      {
        conversationId:
          conversation._id,
        memoryId,
        participantUserId: userId,
        role: 'user',
        content: message,
        groundingStatus:
          'not_applicable',
        citations: [],
      },
      {
        conversationId:
          conversation._id,
        memoryId,
        participantUserId: userId,
        role: 'assistant',
        content: reply.content,
        groundingStatus:
          reply.groundingStatus,
        citations: reply.citations,
      },
    ])

  if (
    !Array.isArray(createdMessages) ||
    createdMessages.length !== 2
  ) {
    throw new Error(
      'Chat exchange could not be persisted.',
    )
  }

  const [
    userMessage,
    assistantMessage,
  ] = createdMessages

  const lastMessageAt =
    assistantMessage.createdAt ??
    userMessage.createdAt ??
    new Date()

  await ChatConversation.updateOne(
    createConversationFilter(
      userId,
      memoryId,
      conversation._id,
    ),
    {
      $set: {
        lastMessageAt,
      },
    },
  )

  return {
    conversation: {
      ...serializeRecord(conversation),
      lastMessageAt,
    },
    userMessage:
      serializeRecord(userMessage),
    assistantMessage:
      serializeRecord(assistantMessage),
  }
}

async function resolveHistoryCursorFilter({
  userId,
  memoryId,
  conversationId,
  beforeMessageId,
}) {
  if (!beforeMessageId) {
    return {}
  }

  const cursorMessage =
    await ChatMessage.findOne({
      _id: beforeMessageId,
      conversationId,
      memoryId,
      participantUserId: userId,
    })
      .select({
        _id: 1,
        createdAt: 1,
      })
      .lean()

  if (
    !cursorMessage ||
    !cursorMessage.createdAt
  ) {
    throw createInvalidHistoryCursorError()
  }

  return {
    $or: [
      {
        createdAt: {
          $lt: cursorMessage.createdAt,
        },
      },
      {
        createdAt:
          cursorMessage.createdAt,
        _id: {
          $lt: cursorMessage._id,
        },
      },
    ],
  }
}

export async function createMemoryChatConversation(
  userId,
  memoryId,
) {
  validateUserId(userId)

  const validatedMemoryId =
    parseMemoryId(memoryId)

  await assertCanChatWithMemory(
    userId,
    validatedMemoryId,
  )

  const conversation =
    await ChatConversation.create({
      memoryId: validatedMemoryId,
      participantUserId: userId,
      status: ACTIVE_CONVERSATION_STATUS,
    })

  return serializeRecord(conversation)
}

export async function sendMemoryChatMessage(
  userId,
  memoryId,
  conversationId,
  input,
) {
  validateUserId(userId)

  const validatedIdentifiers =
    parseConversationIdentifiers(
      memoryId,
      conversationId,
    )

  const {
    message,
    responseMode = 'balanced',
  } = sendChatMessageSchema.parse(input)

  await assertCanChatWithMemory(
    userId,
    validatedIdentifiers.memoryId,
  )

  const conversation =
    await findActiveConversation(
      userId,
      validatedIdentifiers.memoryId,
      validatedIdentifiers.conversationId,
    )

  const [history, context] =
    await Promise.all([
      loadPromptHistory(
        userId,
        validatedIdentifiers.memoryId,
        validatedIdentifiers.conversationId,
      ),
      buildChatContext({
        memoryId:
          validatedIdentifiers.memoryId,
        message,
      }),
    ])

  const providerInput = {
    userId,
    message: context.message,
    sources: context.sources,
    history,
  }

  if (responseMode === 'creative') {
    providerInput.responseMode =
      'creative'
  }

  const reply =
    await generateGroundedChatReply(
      providerInput,
    )

  return persistChatExchange({
    conversation,
    userId,
    memoryId:
      validatedIdentifiers.memoryId,
    message: context.message,
    reply,
  })
}

export async function getMemoryChatHistory(
  userId,
  memoryId,
  conversationId,
  query = {},
) {
  validateUserId(userId)

  const validatedIdentifiers =
    parseConversationIdentifiers(
      memoryId,
      conversationId,
    )

  const validatedQuery =
    chatHistoryQuerySchema.parse(query)

  await assertCanChatWithMemory(
    userId,
    validatedIdentifiers.memoryId,
  )

  const conversation =
    await findActiveConversation(
      userId,
      validatedIdentifiers.memoryId,
      validatedIdentifiers.conversationId,
    )

  const cursorFilter =
    await resolveHistoryCursorFilter({
      userId,
      memoryId:
        validatedIdentifiers.memoryId,
      conversationId:
        validatedIdentifiers.conversationId,
      beforeMessageId:
        validatedQuery.beforeMessageId,
    })

  const descendingMessages =
    await ChatMessage.find({
      conversationId:
        validatedIdentifiers.conversationId,
      memoryId:
        validatedIdentifiers.memoryId,
      participantUserId: userId,
      ...cursorFilter,
    })
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .limit(validatedQuery.limit + 1)
      .lean()

  const hasMore =
    descendingMessages.length >
    validatedQuery.limit

  const pageMessages =
    descendingMessages
      .slice(0, validatedQuery.limit)
      .reverse()
      .map(serializeRecord)

  const oldestMessage =
    pageMessages[0] ?? null

  return {
    conversation:
      serializeRecord(conversation),
    messages: pageMessages,
    pagination: {
      limit: validatedQuery.limit,
      hasMore,
      nextBeforeMessageId:
        hasMore
          ? oldestMessage?.id ?? null
          : null,
    },
  }
}