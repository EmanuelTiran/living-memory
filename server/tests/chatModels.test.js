import mongoose from 'mongoose'
import {
  describe,
  expect,
  it,
} from 'vitest'
import ChatConversation from '../src/modules/chat/ChatConversation.js'
import ChatMessage, {
  CHAT_GROUNDING_STATUSES,
  CHAT_MESSAGE_STORAGE_MAX_LENGTH,
} from '../src/modules/chat/ChatMessage.js'

const memoryId =
  new mongoose.Types.ObjectId()

const participantUserId =
  new mongoose.Types.ObjectId()

const conversationId =
  new mongoose.Types.ObjectId()

const storyId =
  new mongoose.Types.ObjectId()

const validConversationData = {
  memoryId,
  participantUserId,
}

function createMessage(overrides = {}) {
  return new ChatMessage({
    conversationId,
    memoryId,
    participantUserId,
    role: 'user',
    content:
      'What do the approved memories say?',
    ...overrides,
  })
}

function createCitation(overrides = {}) {
  return {
    sourceType: 'memory_story',
    sourceId: storyId.toString(),
    title: 'The first family journey',
    excerpt:
      'The family travelled together.',
    sourceVersion:
      '2026-07-27T10:00:00.000Z',
    ...overrides,
  }
}

async function getValidationError(message) {
  return message
    .validate()
    .catch((error) => error)
}

describe('ChatConversation model', () => {
  it('accepts valid data and applies defaults', async () => {
    const conversation =
      new ChatConversation(
        validConversationData,
      )

    await expect(
      conversation.validate(),
    ).resolves.toBeUndefined()

    expect(conversation.status).toBe(
      'active',
    )

    expect(
      conversation.lastMessageAt,
    ).toBeInstanceOf(Date)
  })

  it('rejects missing or invalid fields', async () => {
    const conversation =
      new ChatConversation({
        status: 'deleted',
      })

    const validationError =
      await conversation
        .validate()
        .catch((error) => error)

    expect(validationError).toHaveProperty(
      'errors.memoryId',
    )

    expect(validationError).toHaveProperty(
      'errors.participantUserId',
    )

    expect(validationError).toHaveProperty(
      'errors.status',
    )
  })

  it('returns a public conversation identifier', () => {
    const conversation =
      new ChatConversation(
        validConversationData,
      )

    const output = conversation.toJSON()

    expect(output.id).toBe(
      conversation._id.toString(),
    )

    expect(output).not.toHaveProperty('_id')
  })

  it('declares conversation lookup indexes', () => {
    const indexes =
      ChatConversation.schema.indexes()

    const memoryParticipantIndex =
      indexes.find(
        ([fields]) =>
          fields.memoryId === 1 &&
          fields.participantUserId === 1 &&
          fields.lastMessageAt === -1,
      )

    const participantStatusIndex =
      indexes.find(
        ([fields]) =>
          fields.participantUserId === 1 &&
          fields.status === 1 &&
          fields.lastMessageAt === -1,
      )

    expect(
      memoryParticipantIndex?.[1],
    ).toMatchObject({
      name:
        'chat_conversations_memory_participant_recent',
    })

    expect(
      participantStatusIndex?.[1],
    ).toMatchObject({
      name:
        'chat_conversations_participant_status_recent',
    })
  })
})

describe('ChatMessage model', () => {
  it('declares every supported answer classification', () => {
    expect(
      CHAT_GROUNDING_STATUSES,
    ).toEqual([
      'not_applicable',
      'grounded',
      'inferred',
      'general_knowledge',
      'creative',
      'insufficient_context',
    ])
  })

  it('accepts a user message with safe defaults', async () => {
    const message = createMessage()

    await expect(
      message.validate(),
    ).resolves.toBeUndefined()

    expect(message.groundingStatus).toBe(
      'not_applicable',
    )

    expect(message.citations).toEqual([])
  })

  it.each([
    'grounded',
    'inferred',
  ])(
    'accepts a %s assistant message with a citation',
    async (groundingStatus) => {
      const citation = createCitation()

      const message = createMessage({
        role: 'assistant',
        content:
          'The approved source supports this answer.',
        groundingStatus,
        citations: [citation],
      })

      await expect(
        message.validate(),
      ).resolves.toBeUndefined()

      expect(
        message.citations[0],
      ).toMatchObject({
        sourceType:
          citation.sourceType,
        sourceId: citation.sourceId,
        title: citation.title,
        sourceVersion:
          citation.sourceVersion,
      })
    },
  )

  it.each([
    'general_knowledge',
    'creative',
    'insufficient_context',
  ])(
    'accepts a %s assistant message without citations',
    async (groundingStatus) => {
      const message = createMessage({
        role: 'assistant',
        content:
          'This answer does not claim support from an approved source.',
        groundingStatus,
      })

      await expect(
        message.validate(),
      ).resolves.toBeUndefined()

      expect(message.citations).toEqual([])
    },
  )

  it.each([
    'grounded',
    'inferred',
  ])(
    'rejects a %s response without citations',
    async (groundingStatus) => {
      const message = createMessage({
        role: 'assistant',
        content:
          'This answer claims to use a source.',
        groundingStatus,
      })

      const validationError =
        await getValidationError(message)

      expect(
        validationError,
      ).toHaveProperty(
        'errors.citations',
      )
    },
  )

  it.each([
    'general_knowledge',
    'creative',
    'insufficient_context',
  ])(
    'rejects citations on a %s response',
    async (groundingStatus) => {
      const message = createMessage({
        role: 'assistant',
        content:
          'This answer must not cite approved evidence.',
        groundingStatus,
        citations: [createCitation()],
      })

      const validationError =
        await getValidationError(message)

      expect(
        validationError,
      ).toHaveProperty(
        'errors.citations',
      )
    },
  )

  it('rejects citations on a user message', async () => {
    const message = createMessage({
      citations: [createCitation()],
    })

    const validationError =
      await getValidationError(message)

    expect(validationError).toHaveProperty(
      'errors.citations',
    )
  })

  it('requires citation approval metadata', async () => {
    const message = createMessage({
      role: 'assistant',
      content:
        'This answer uses an unversioned source.',
      groundingStatus: 'grounded',
      citations: [
        createCitation({
          sourceVersion: '',
        }),
      ],
    })

    const validationError =
      await getValidationError(message)

    expect(validationError).toHaveProperty(
      'errors.citations',
    )
  })

  it('rejects oversized stored content', async () => {
    const message = createMessage({
      content: 'a'.repeat(
        CHAT_MESSAGE_STORAGE_MAX_LENGTH +
          1,
      ),
    })

    const validationError =
      await getValidationError(message)

    expect(validationError).toHaveProperty(
      'errors.content',
    )
  })

  it('returns a public message identifier', () => {
    const message = createMessage()
    const output = message.toJSON()

    expect(output.id).toBe(
      message._id.toString(),
    )

    expect(output).not.toHaveProperty('_id')
  })

  it('declares secure history indexes', () => {
    const indexes =
      ChatMessage.schema.indexes()

    const conversationIndex =
      indexes.find(
        ([fields]) =>
          fields.conversationId === 1 &&
          fields.createdAt === 1 &&
          fields._id === 1,
      )

    const scopedHistoryIndex =
      indexes.find(
        ([fields]) =>
          fields.memoryId === 1 &&
          fields.participantUserId === 1 &&
          fields.createdAt === -1,
      )

    expect(
      conversationIndex?.[1],
    ).toMatchObject({
      name:
        'chat_messages_conversation_chronological',
    })

    expect(
      scopedHistoryIndex?.[1],
    ).toMatchObject({
      name:
        'chat_messages_memory_participant_recent',
    })
  })
})