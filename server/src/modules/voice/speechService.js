import { AppError } from '../../errors/AppError.js'
import ChatConversation from '../chat/ChatConversation.js'
import ChatMessage from '../chat/ChatMessage.js'
import {
  assertCanChatWithMemory,
} from '../memories/memoryAccessService.js'
import {
  generateSpeechAudio,
  SPEECH_TEXT_MAX_LENGTH,
} from './openaiSpeechProvider.js'
import {
  splitSpeechText,
} from './speechChunking.js'
import {
  chatSpeechParamsSchema,
  realtimeAvatarSpeechChunkParamsSchema,
} from './speechValidation.js'
import {
  tryGenerateClonedSpeech,
} from './voiceCloneSpeechService.js'

const ACTIVE_CONVERSATION_STATUS =
  'active'

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
      code:
        'CHAT_CONVERSATION_NOT_FOUND',
    },
  )
}

function createMessageNotFoundError() {
  return new AppError(
    'Chat message was not found.',
    {
      statusCode: 404,
      code: 'CHAT_MESSAGE_NOT_FOUND',
    },
  )
}

function createMessageNotSpeakableError() {
  return new AppError(
    'This chat message cannot be converted to speech.',
    {
      statusCode: 422,
      code:
        'CHAT_MESSAGE_NOT_SPEAKABLE',
    },
  )
}

function createSpeechChunkNotFoundError() {
  return new AppError(
    'The requested speech chunk was not found.',
    {
      statusCode: 404,
      code:
        'REALTIME_SPEECH_CHUNK_NOT_FOUND',
    },
  )
}

async function findActiveConversation(
  userId,
  {
    memoryId,
    conversationId,
  },
) {
  const conversation =
    await ChatConversation.findOne({
      _id: conversationId,
      memoryId,
      participantUserId: userId,
      status:
        ACTIVE_CONVERSATION_STATUS,
    })

  if (!conversation) {
    throw createConversationNotFoundError()
  }

  return conversation
}

async function findAssistantMessage(
  userId,
  {
    memoryId,
    conversationId,
    messageId,
  },
) {
  const messageQuery =
    ChatMessage.findOne({
      _id: messageId,
      conversationId,
      memoryId,
      participantUserId: userId,
      role: 'assistant',
    })
      .select({
        _id: 1,
        content: 1,
      })
      .lean()

  const message = await messageQuery

  if (!message) {
    throw createMessageNotFoundError()
  }

  return message
}

function validateSpeakableContent(content) {
  if (
    typeof content !== 'string' ||
    content.trim().length === 0 ||
    content.length >
      SPEECH_TEXT_MAX_LENGTH
  ) {
    throw createMessageNotSpeakableError()
  }

  return content
}

async function loadSpeakableMessage(
  userId,
  validatedIdentifiers,
) {
  await assertCanChatWithMemory(
    userId,
    validatedIdentifiers.memoryId,
  )

  await findActiveConversation(
    userId,
    validatedIdentifiers,
  )

  const assistantMessage =
    await findAssistantMessage(
      userId,
      validatedIdentifiers,
    )

  return validateSpeakableContent(
    assistantMessage.content,
  )
}

async function generateSpeechForText({
  userId,
  memoryId,
  text,
  preferClonedVoice = false,
}) {
  if (preferClonedVoice) {
    const clonedSpeech =
      await tryGenerateClonedSpeech({
        memoryId,
        text,
      })

    if (clonedSpeech) {
      return clonedSpeech
    }
  }

  return generateSpeechAudio({
    userId,
    text,
  })
}

export async function generateMemoryChatMessageSpeech(
  userId,
  memoryId,
  conversationId,
  messageId,
  {
    preferClonedVoice = false,
  } = {},
) {
  validateUserId(userId)

  const validatedIdentifiers =
    chatSpeechParamsSchema.parse({
      memoryId,
      conversationId,
      messageId,
    })

  const text =
    await loadSpeakableMessage(
      userId,
      validatedIdentifiers,
    )

  return generateSpeechForText({
    userId,
    memoryId:
      validatedIdentifiers.memoryId,
    text,
    preferClonedVoice,
  })
}

export async function generateMemoryChatMessageSpeechChunk(
  userId,
  memoryId,
  conversationId,
  messageId,
  chunkIndex,
  {
    preferClonedVoice = false,
  } = {},
) {
  validateUserId(userId)

  const validatedIdentifiers =
    realtimeAvatarSpeechChunkParamsSchema.parse({
      memoryId,
      conversationId,
      messageId,
      chunkIndex,
    })

  const text =
    await loadSpeakableMessage(
      userId,
      validatedIdentifiers,
    )

  const chunks = splitSpeechText(text)
  const chunkText =
    chunks[validatedIdentifiers.chunkIndex]

  if (!chunkText) {
    throw createSpeechChunkNotFoundError()
  }

  const speech =
    await generateSpeechForText({
      userId,
      memoryId:
        validatedIdentifiers.memoryId,
      text: chunkText,
      preferClonedVoice,
    })

  return {
    speech,
    chunkIndex:
      validatedIdentifiers.chunkIndex,
    chunkCount: chunks.length,
  }
}
