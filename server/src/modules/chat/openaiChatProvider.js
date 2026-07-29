import { createHash } from 'node:crypto'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import { env } from '../../config/env.js'
import { AppError } from '../../errors/AppError.js'
import { createApprovedSource } from './approvedSource.js'
import {
  INSUFFICIENT_CONTEXT_RESPONSE,
  MAX_CHAT_CONTEXT_SOURCES,
} from './chatContextService.js'
import {
  CHAT_RESPONSE_MODES,
  MAX_CHAT_PROMPT_HISTORY_MESSAGES,
  MEMORY_CHAT_INSTRUCTIONS,
  buildMemoryChatInput,
} from './memoryChatPrompt.js'
import { getOpenAIClient } from './openaiClient.js'
import { sendChatMessageSchema } from './validation.js'

const OPENAI_REPLY_MAX_LENGTH = 8000

const SOURCE_BACKED_STATUSES =
  new Set([
    'grounded',
    'inferred',
  ])

const SOURCE_FREE_STATUSES =
  new Set([
    'general_knowledge',
    'creative',
  ])

const chatResponseModeSchema =
  z.enum(CHAT_RESPONSE_MODES)

const openAIReplySchema = z.object({
  groundingStatus: z.enum([
    'grounded',
    'inferred',
    'general_knowledge',
    'creative',
    'insufficient_context',
  ]),

  answer: z
    .string()
    .trim()
    .min(1)
    .max(OPENAI_REPLY_MAX_LENGTH),

  usedSourceIds: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(100),
    )
    .max(MAX_CHAT_CONTEXT_SOURCES),
})

const historyEntrySchema =
  z.strictObject({
    role: z.enum([
      'user',
      'assistant',
    ]),

    content: z
      .string()
      .trim()
      .min(1)
      .max(OPENAI_REPLY_MAX_LENGTH),
  })

const chatHistorySchema = z
  .array(historyEntrySchema)
  .max(
    MAX_CHAT_PROMPT_HISTORY_MESSAGES,
  )

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

function createProviderError() {
  return new AppError(
    'The AI service is temporarily unavailable.',
    {
      statusCode: 502,
      code: 'AI_PROVIDER_ERROR',
    },
  )
}

function createInvalidResponseError() {
  return new AppError(
    'The AI service returned an invalid response.',
    {
      statusCode: 502,
      code: 'AI_INVALID_RESPONSE',
    },
  )
}

function createCitation(source) {
  return {
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    title: source.title,
    excerpt:
      source.content
        .slice(0, 300)
        .trim(),
    approvedAt:
      source.approvedAt,
    sourceVersion:
      source.sourceVersion,
  }
}

function createInsufficientContextReply({
  model = null,
  provider = 'local_policy',
  providerResponseId = null,
} = {}) {
  return {
    content:
      INSUFFICIENT_CONTEXT_RESPONSE,
    groundingStatus:
      'insufficient_context',
    citations: [],
    provider,
    model,
    providerResponseId,
  }
}

function normalizeSources(sources) {
  if (!Array.isArray(sources)) {
    throw new TypeError(
      'Approved sources must be an array.',
    )
  }

  if (
    sources.length >
    MAX_CHAT_CONTEXT_SOURCES
  ) {
    throw new TypeError(
      `Approved sources must not exceed ${MAX_CHAT_CONTEXT_SOURCES}.`,
    )
  }

  return sources.map((source) =>
    createApprovedSource(source),
  )
}

function validateProviderResponse(
  response,
) {
  const result =
    openAIReplySchema.safeParse(
      response?.output_parsed,
    )

  if (!result.success) {
    throw createInvalidResponseError()
  }

  return result.data
}

function validateReplyMode(
  groundingStatus,
  responseMode,
) {
  if (
    responseMode === 'balanced' &&
    groundingStatus === 'creative'
  ) {
    throw createInvalidResponseError()
  }

  if (
    responseMode === 'creative' &&
    groundingStatus !== 'creative' &&
    groundingStatus !==
      'insufficient_context'
  ) {
    throw createInvalidResponseError()
  }
}

function createSourceBackedReply({
  parsedReply,
  approvedSources,
  model,
  providerResponseId,
}) {
  const sourceById = new Map(
    approvedSources.map((source) => [
      source.sourceId,
      source,
    ]),
  )

  const uniqueUsedSourceIds =
    Array.from(
      new Set(
        parsedReply.usedSourceIds,
      ),
    )

  const hasUnknownSource =
    uniqueUsedSourceIds.some(
      (sourceId) =>
        !sourceById.has(sourceId),
    )

  if (
    hasUnknownSource ||
    uniqueUsedSourceIds.length === 0
  ) {
    return createInsufficientContextReply({
      model,
      provider: 'openai',
      providerResponseId,
    })
  }

  return {
    content: parsedReply.answer,
    groundingStatus:
      parsedReply.groundingStatus,
    citations:
      uniqueUsedSourceIds.map(
        (sourceId) =>
          createCitation(
            sourceById.get(sourceId),
          ),
      ),
    provider: 'openai',
    model,
    providerResponseId,
  }
}

export function createSafetyIdentifier(
  userId,
) {
  validateUserId(userId)

  return createHash('sha256')
    .update(`living-memory:${userId}`)
    .digest('hex')
}

export async function generateMemoryChatReply(
  {
    userId,
    message,
    sources,
    history = [],
    responseMode = 'balanced',
  },
  {
    client,
    model = env.openaiModel,
    maxOutputTokens =
      env.openaiMaxOutputTokens,
  } = {},
) {
  validateUserId(userId)

  const validatedMessage =
    sendChatMessageSchema.parse({
      message,
    }).message

  const validatedHistory =
    chatHistorySchema.parse(history)

  const validatedResponseMode =
    chatResponseModeSchema.parse(
      responseMode,
    )

  const approvedSources =
    normalizeSources(sources)

  const openAIClient =
    client ?? getOpenAIClient()

  let response

  try {
    response =
      await openAIClient.responses.parse({
        model,
        instructions:
          MEMORY_CHAT_INSTRUCTIONS,
        input: buildMemoryChatInput({
          message: validatedMessage,
          sources: approvedSources,
          history: validatedHistory,
          responseMode:
            validatedResponseMode,
        }),
        reasoning: {
          effort: 'low',
        },
        text: {
          verbosity: 'low',
          format: zodTextFormat(
            openAIReplySchema,
            'memory_chat_reply',
          ),
        },
        max_output_tokens:
          maxOutputTokens,
        safety_identifier:
          createSafetyIdentifier(userId),
        store: false,
      })
  } catch (error) {
    if (error instanceof AppError) {
      throw error
    }

    throw createProviderError()
  }

  const parsedReply =
    validateProviderResponse(response)

  validateReplyMode(
    parsedReply.groundingStatus,
    validatedResponseMode,
  )

  const providerResponseId =
    response.id ?? null

  if (
    parsedReply.groundingStatus ===
    'insufficient_context'
  ) {
    return createInsufficientContextReply({
      model,
      provider: 'openai',
      providerResponseId,
    })
  }

  if (
    SOURCE_BACKED_STATUSES.has(
      parsedReply.groundingStatus,
    )
  ) {
    return createSourceBackedReply({
      parsedReply,
      approvedSources,
      model,
      providerResponseId,
    })
  }

  if (
    SOURCE_FREE_STATUSES.has(
      parsedReply.groundingStatus,
    )
  ) {
    if (
      parsedReply.usedSourceIds.length > 0
    ) {
      throw createInvalidResponseError()
    }

    return {
      content: parsedReply.answer,
      groundingStatus:
        parsedReply.groundingStatus,
      citations: [],
      provider: 'openai',
      model,
      providerResponseId,
    }
  }

  throw createInvalidResponseError()
}

export const generateGroundedChatReply =
  generateMemoryChatReply