import mongoose from 'mongoose'
import {
  describe,
  expect,
  it,
} from 'vitest'
import MemoryBiographyAnswer from '../src/modules/memories/MemoryBiographyAnswer.js'

const memoryId =
  new mongoose.Types.ObjectId()

const userId =
  new mongoose.Types.ObjectId()

const messageId =
  new mongoose.Types.ObjectId()

function createCreativeAnswer(
  overrides = {},
) {
  return new MemoryBiographyAnswer({
    memoryId,
    createdByUserId: userId,
    question:
      'What might her favorite color have been?',
    answer:
      'She may have preferred blue.',
    origin: 'creative_chat',
    sourceChatMessageId: messageId,
    status: 'approved',
    approvedAt:
      new Date(
        '2026-07-28T10:00:00.000Z',
      ),
    approvedByUserId: userId,
    ...overrides,
  })
}

function createQuestionnaireAnswer(
  overrides = {},
) {
  return new MemoryBiographyAnswer({
    memoryId,
    createdByUserId: userId,
    questionKey: 'birth_place',
    question:
      'Where was this person born?',
    answer: 'Jerusalem',
    origin: 'questionnaire',
    status: 'draft',
    ...overrides,
  })
}

async function getValidationError(document) {
  return document
    .validate()
    .catch((error) => error)
}

describe('MemoryBiographyAnswer model', () => {
  it('accepts an approved creative-chat answer with traceability', async () => {
    const answer =
      createCreativeAnswer()

    await expect(
      answer.validate(),
    ).resolves.toBeUndefined()

    expect(answer.origin).toBe(
      'creative_chat',
    )

    expect(
      answer.sourceChatMessageId,
    ).toEqual(messageId)

    expect(answer.status).toBe(
      'approved',
    )

    expect(answer.revision).toBe(1)
  })

  it('accepts a draft questionnaire answer', async () => {
    const answer =
      createQuestionnaireAnswer()

    await expect(
      answer.validate(),
    ).resolves.toBeUndefined()

    expect(answer.questionKey).toBe(
      'birth_place',
    )

    expect(
      answer.sourceChatMessageId,
    ).toBeNull()

    expect(answer.status).toBe('draft')
  })

  it('requires a source chat message for a creative answer', async () => {
    const answer =
      createCreativeAnswer({
        sourceChatMessageId: null,
      })

    const validationError =
      await getValidationError(answer)

    expect(validationError).toHaveProperty(
      'errors.sourceChatMessageId',
    )
  })

  it('keeps questionnaire and creative origins separate', async () => {
    const questionnaireAnswer =
      createQuestionnaireAnswer({
        questionKey: '',
      })

    const creativeAnswer =
      createCreativeAnswer({
        questionKey: 'favorite_color',
      })

    const questionnaireError =
      await getValidationError(
        questionnaireAnswer,
      )

    const creativeError =
      await getValidationError(
        creativeAnswer,
      )

    expect(
      questionnaireError,
    ).toHaveProperty(
      'errors.questionKey',
    )

    expect(creativeError).toHaveProperty(
      'errors.questionKey',
    )
  })

  it('requires approval metadata for an approved answer', async () => {
    const answer =
      createCreativeAnswer({
        approvedAt: null,
        approvedByUserId: null,
      })

    const validationError =
      await getValidationError(answer)

    expect(validationError).toHaveProperty(
      'errors.approvedAt',
    )

    expect(validationError).toHaveProperty(
      'errors.approvedByUserId',
    )
  })

  it('rejects approval metadata on a draft answer', async () => {
    const answer =
      createQuestionnaireAnswer({
        approvedAt: new Date(),
        approvedByUserId: userId,
      })

    const validationError =
      await getValidationError(answer)

    expect(validationError).toHaveProperty(
      'errors.approvedAt',
    )

    expect(validationError).toHaveProperty(
      'errors.approvedByUserId',
    )
  })

  it('returns a public answer identifier', () => {
    const answer =
      createQuestionnaireAnswer()

    const output = answer.toJSON()

    expect(output.id).toBe(
      answer._id.toString(),
    )

    expect(output).not.toHaveProperty('_id')
  })

  it('declares lookup and duplicate-prevention indexes', () => {
    const indexes =
      MemoryBiographyAnswer.schema
        .indexes()

    const statusIndex =
      indexes.find(
        ([, options]) =>
          options.name ===
          'memory_biography_answers_memory_status_updated',
      )

    const creativeIndex =
      indexes.find(
        ([, options]) =>
          options.name ===
          'memory_biography_answers_unique_creative_message',
      )

    const questionIndex =
      indexes.find(
        ([, options]) =>
          options.name ===
          'memory_biography_answers_unique_question',
      )

    expect(statusIndex?.[0]).toEqual({
      memoryId: 1,
      status: 1,
      updatedAt: -1,
    })

    expect(
      creativeIndex?.[1],
    ).toMatchObject({
      unique: true,
      partialFilterExpression: {
        origin: 'creative_chat',
      },
    })

    expect(
      questionIndex?.[1],
    ).toMatchObject({
      unique: true,
      partialFilterExpression: {
        origin: 'questionnaire',
      },
    })
  })
})