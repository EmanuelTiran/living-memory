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
  getBiographyQuestionnaire: vi.fn(),
  saveBiographyQuestionnaireAnswer:
    vi.fn(),
  promoteCreativeChatReply: vi.fn(),
}))

vi.mock(
  '../src/modules/auth/tokens.js',
  () => ({
    verifyAccessToken:
      mocks.verifyAccessToken,
  }),
)

vi.mock(
  '../src/modules/memories/biographyService.js',
  () => ({
    getBiographyQuestionnaire:
      mocks.getBiographyQuestionnaire,
    saveBiographyQuestionnaireAnswer:
      mocks.saveBiographyQuestionnaireAnswer,
    promoteCreativeChatReply:
      mocks.promoteCreativeChatReply,
  }),
)

import app from '../src/app.js'

const userId =
  '507f1f77bcf86cd799439010'

const memoryId =
  '507f1f77bcf86cd799439011'

const messageId =
  '507f1f77bcf86cd799439012'

const biographyAnswer = {
  id:
    '507f1f77bcf86cd799439013',
  memoryId,
  createdByUserId: userId,
  question:
    'What was her favorite color?',
  answer: 'She preferred blue.',
  origin: 'creative_chat',
  sourceChatMessageId: messageId,
  status: 'approved',
  approvedAt:
    '2026-07-28T11:00:00.000Z',
  approvedByUserId: userId,
  revision: 1,
}

const questionnaireAnswer = {
  id:
    '507f1f77bcf86cd799439014',
  memoryId,
  createdByUserId: userId,
  questionKey:
    'birth_place_type',
  question:
    'באיזה סוג מקום נולד האדם?',
  answer: 'עיר גדולה',
  origin: 'questionnaire',
  status: 'approved',
  approvedAt:
    '2026-07-28T12:00:00.000Z',
  approvedByUserId: userId,
  revision: 1,
  selectedOptionKey:
    'large_city',
}

const questionnaire = {
  questions: [
    {
      key: 'birth_place_type',
      category: 'background',
      question:
        'באיזה סוג מקום נולד האדם?',
      options: [
        {
          key: 'large_city',
          label: 'עיר גדולה',
        },
        {
          key: 'small_town',
          label:
            'עיר או עיירה קטנה',
        },
        {
          key: 'village',
          label:
            'מושב, קיבוץ או כפר',
        },
        {
          key: 'rural_area',
          label:
            'אזור כפרי או מרוחק',
        },
      ],
    },
  ],
  answers: [],
  progress: {
    totalCount: 80,
    completedCount: 0,
    remainingCount: 80,
    batchSize: 5,
    isComplete: false,
  },
}

const authentication = {
  userId,
  systemRole: 'user',
  tokenId: 'token-id',
  expiresAt: new Date(
    Date.now() + 15 * 60 * 1000,
  ),
}

beforeEach(() => {
  vi.resetAllMocks()

  mocks.verifyAccessToken
    .mockResolvedValue(
      authentication,
    )

  mocks.getBiographyQuestionnaire
    .mockResolvedValue(
      questionnaire,
    )

  mocks.saveBiographyQuestionnaireAnswer
    .mockResolvedValue(
      questionnaireAnswer,
    )

  mocks.promoteCreativeChatReply
    .mockResolvedValue(
      biographyAnswer,
    )
})

describe('Biography routes', () => {
  it('returns the biography questionnaire', async () => {
    const response = await request(app)
      .get(
        `/api/memories/${memoryId}/biography/questionnaire`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )

    expect(response.status).toBe(200)

    expect(
      mocks.getBiographyQuestionnaire,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
    )

    expect(response.body).toEqual({
      success: true,
      data: {
        questionnaire,
      },
    })
  })

  it('saves a predefined questionnaire option', async () => {
    const response = await request(app)
      .put(
        `/api/memories/${memoryId}/biography/questionnaire/answers/birth_place_type`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )
      .send({
        optionKey: 'large_city',
      })

    expect(response.status).toBe(200)

    expect(
      mocks.saveBiographyQuestionnaireAnswer,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
      'birth_place_type',
      {
        optionKey: 'large_city',
      },
    )

    expect(response.body).toEqual({
      success: true,
      data: {
        biographyAnswer:
          questionnaireAnswer,
      },
    })
  })

  it('saves a trimmed custom questionnaire answer', async () => {
    const customAnswer = {
      ...questionnaireAnswer,
      answer:
        'נולד בשכונה קטנה ליד הים',
      selectedOptionKey: null,
    }

    mocks.saveBiographyQuestionnaireAnswer
      .mockResolvedValue(
        customAnswer,
      )

    const response = await request(app)
      .put(
        `/api/memories/${memoryId}/biography/questionnaire/answers/birth_place_type`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )
      .send({
        customAnswer:
          '  נולד בשכונה קטנה ליד הים  ',
      })

    expect(response.status).toBe(200)

    expect(
      mocks.saveBiographyQuestionnaireAnswer,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
      'birth_place_type',
      {
        customAnswer:
          'נולד בשכונה קטנה ליד הים',
      },
    )

    expect(
      response.body.data
        .biographyAnswer,
    ).toEqual(customAnswer)
  })

  it('rejects invalid questionnaire identifiers and content', async () => {
    const invalidIdentifierResponse =
      await request(app)
        .put(
          `/api/memories/${memoryId}/biography/questionnaire/answers/INVALID-KEY`,
        )
        .set(
          'Authorization',
          'Bearer valid-access-token',
        )
        .send({
          optionKey:
            'large_city',
        })

    expect(
      invalidIdentifierResponse.status,
    ).toBe(400)

    const emptyContentResponse =
      await request(app)
        .put(
          `/api/memories/${memoryId}/biography/questionnaire/answers/birth_place_type`,
        )
        .set(
          'Authorization',
          'Bearer valid-access-token',
        )
        .send({
          customAnswer: ' ',
        })

    expect(
      emptyContentResponse.status,
    ).toBe(400)

    const ambiguousContentResponse =
      await request(app)
        .put(
          `/api/memories/${memoryId}/biography/questionnaire/answers/birth_place_type`,
        )
        .set(
          'Authorization',
          'Bearer valid-access-token',
        )
        .send({
          optionKey:
            'large_city',
          customAnswer:
            'תשובה נוספת',
        })

    expect(
      ambiguousContentResponse.status,
    ).toBe(400)

    expect(
      mocks.saveBiographyQuestionnaireAnswer,
    ).not.toHaveBeenCalled()
  })

  it('requires authentication for the questionnaire', async () => {
    mocks.verifyAccessToken
      .mockRejectedValue(
        new AppError(
          'Authentication is required.',
          {
            statusCode: 401,
            code:
              'AUTHENTICATION_REQUIRED',
          },
        ),
      )

    const response = await request(app)
      .get(
        `/api/memories/${memoryId}/biography/questionnaire`,
      )

    expect(response.status).toBe(401)

    expect(
      mocks.getBiographyQuestionnaire,
    ).not.toHaveBeenCalled()
  })

  it('promotes a creative message with validated input', async () => {
    const response = await request(app)
      .post(
        `/api/memories/${memoryId}/biography/creative-messages/${messageId}`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )
      .send({
        question:
          '  What was her favorite color?  ',
        answer:
          '  She preferred blue.  ',
      })

    expect(response.status).toBe(201)

    expect(
      mocks.promoteCreativeChatReply,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
      messageId,
      {
        question:
          'What was her favorite color?',
        answer:
          'She preferred blue.',
      },
    )

    expect(response.body).toEqual({
      success: true,
      data: {
        biographyAnswer,
      },
    })
  })

  it('requires authentication for creative promotion', async () => {
    mocks.verifyAccessToken
      .mockRejectedValue(
        new AppError(
          'Authentication is required.',
          {
            statusCode: 401,
            code:
              'AUTHENTICATION_REQUIRED',
          },
        ),
      )

    const response = await request(app)
      .post(
        `/api/memories/${memoryId}/biography/creative-messages/${messageId}`,
      )
      .send({
        question:
          'What was her favorite color?',
        answer:
          'She preferred blue.',
      })

    expect(response.status).toBe(401)

    expect(
      mocks.promoteCreativeChatReply,
    ).not.toHaveBeenCalled()
  })

  it('rejects invalid creative identifiers and content', async () => {
    const invalidIdentifierResponse =
      await request(app)
        .post(
          `/api/memories/${memoryId}/biography/creative-messages/invalid-message`,
        )
        .set(
          'Authorization',
          'Bearer valid-access-token',
        )
        .send({
          question:
            'What was her favorite color?',
          answer:
            'She preferred blue.',
        })

    expect(
      invalidIdentifierResponse.status,
    ).toBe(400)

    const invalidContentResponse =
      await request(app)
        .post(
          `/api/memories/${memoryId}/biography/creative-messages/${messageId}`,
        )
        .set(
          'Authorization',
          'Bearer valid-access-token',
        )
        .send({
          question: ' ',
          answer: ' ',
        })

    expect(
      invalidContentResponse.status,
    ).toBe(400)

    expect(
      mocks.promoteCreativeChatReply,
    ).not.toHaveBeenCalled()
  })

  it('returns a safe response when permission is denied', async () => {
    mocks.promoteCreativeChatReply
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
        `/api/memories/${memoryId}/biography/creative-messages/${messageId}`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )
      .send({
        question:
          'What was her favorite color?',
        answer:
          'She preferred blue.',
      })

    expect(response.status).toBe(404)

    expect(
      response.body.error,
    ).toMatchObject({
      code: 'MEMORY_NOT_FOUND',
      message:
        'Memory profile was not found.',
      requestId: expect.any(String),
    })
  })
})