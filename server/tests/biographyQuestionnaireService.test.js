import {
    afterEach,
    describe,
    expect,
    it,
    vi,
  } from 'vitest'

  const mocks = vi.hoisted(() => ({
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    exists: vi.fn(),
    requireMemoryPermission: vi.fn(),
  }))

  vi.mock(
    '../src/modules/memories/MemoryBiographyAnswer.js',
    async (importOriginal) => {
      const actual =
        await importOriginal()

      return {
        ...actual,
        default: {
          find: mocks.find,
          findOne: mocks.findOne,
          create: mocks.create,
          exists: mocks.exists,
        },
      }
    },
  )

  vi.mock(
    '../src/modules/memories/memoryAccessService.js',
    () => ({
      MEMORY_PERMISSIONS: {
        VIEW: 'view',
        CHAT: 'chat',
        CONTRIBUTE: 'contribute',
        EDIT: 'edit',
        MANAGE: 'manage',
      },
      requireMemoryPermission:
        mocks.requireMemoryPermission,
    }),
  )

  import {
    BIOGRAPHY_QUESTIONS,
    getBiographyQuestion,
  } from '../src/modules/memories/biographyQuestionCatalog.js'
  import {
    getBiographyQuestionnaire,
    saveBiographyQuestionnaireAnswer,
  } from '../src/modules/memories/biographyService.js'

  const userId =
    '507f1f77bcf86cd799439010'

  const memoryId =
    '507f1f77bcf86cd799439011'

  function createAnswerDocument({
    id =
      '507f1f77bcf86cd799439012',
    questionKey =
      'birth_place_type',
    question =
      'באיזה סוג מקום נולד האדם?',
    answer =
      'עיר גדולה',
    revision = 1,
    status = 'approved',
  } = {}) {
    const document = {
      _id: id,
      id,
      memoryId,
      createdByUserId: userId,
      questionKey,
      question,
      answer,
      origin: 'questionnaire',
      status,
      approvedAt:
        new Date(
          '2026-07-28T10:00:00.000Z',
        ),
      approvedByUserId: userId,
      revision,

      async save() {
        return this
      },

      toJSON() {
        return {
          id: this.id,
          memoryId: this.memoryId,
          createdByUserId:
            this.createdByUserId,
          questionKey:
            this.questionKey,
          question: this.question,
          answer: this.answer,
          origin: this.origin,
          status: this.status,
          approvedAt:
            this.approvedAt,
          approvedByUserId:
            this.approvedByUserId,
          revision: this.revision,
        }
      },
    }

    vi.spyOn(document, 'save')

    return document
  }

  function mockAnswersQuery(answers) {
    const sort = vi.fn()
      .mockResolvedValue(answers)

    mocks.find.mockReturnValue({
      sort,
    })

    return sort
  }

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Biography question catalog', () => {
    it('contains 80 unique questions with four options each', () => {
      expect(
        BIOGRAPHY_QUESTIONS,
      ).toHaveLength(80)

      expect(
        new Set(
          BIOGRAPHY_QUESTIONS.map(
            (question) =>
              question.key,
          ),
        ).size,
      ).toBe(80)

      for (
        const question
        of BIOGRAPHY_QUESTIONS
      ) {
        expect(
          question.options,
        ).toHaveLength(4)

        expect(
          new Set(
            question.options.map(
              (option) =>
                option.key,
            ),
          ).size,
        ).toBe(4)
      }
    })
  })

  describe('Biography questionnaire service', () => {
    it('returns the next five unanswered questions and progress', async () => {
      const existingAnswer =
        createAnswerDocument()

      mockAnswersQuery([
        existingAnswer,
      ])

      const result =
        await getBiographyQuestionnaire(
          userId,
          memoryId,
        )

      expect(
        mocks.requireMemoryPermission,
      ).toHaveBeenCalledWith(
        userId,
        memoryId,
        'manage',
      )

      expect(result.questions)
        .toHaveLength(5)

      expect(
        result.questions[0].key,
      ).toBe(
        'childhood_environment',
      )

      expect(result.answers)
        .toHaveLength(1)

      expect(result.answers[0])
        .toMatchObject({
          questionKey:
            'birth_place_type',
          selectedOptionKey:
            'large_city',
        })

      expect(result.progress)
        .toEqual({
          totalCount: 80,
          completedCount: 1,
          remainingCount: 79,
          batchSize: 5,
          isComplete: false,
        })
    })

    it('saves an approved predefined answer from the server catalog', async () => {
      const createdDocument =
        createAnswerDocument()

      mocks.findOne
        .mockResolvedValue(null)

      mocks.create
        .mockResolvedValue(
          createdDocument,
        )

      const result =
        await saveBiographyQuestionnaireAnswer(
          userId,
          memoryId,
          'birth_place_type',
          {
            optionKey: 'large_city',
          },
        )

      expect(
        mocks.requireMemoryPermission,
      ).toHaveBeenCalledWith(
        userId,
        memoryId,
        'manage',
      )

      expect(mocks.create)
        .toHaveBeenCalledWith(
          expect.objectContaining({
            memoryId,
            createdByUserId: userId,
            questionKey:
              'birth_place_type',
            question:
              'באיזה סוג מקום נולד האדם?',
            answer: 'עיר גדולה',
            origin: 'questionnaire',
            status: 'approved',
            approvedByUserId: userId,
            revision: 1,
          }),
        )

      expect(result)
        .toMatchObject({
          questionKey:
            'birth_place_type',
          answer: 'עיר גדולה',
          selectedOptionKey:
            'large_city',
        })
    })

    it('saves a trimmed custom answer', async () => {
      const createdDocument =
        createAnswerDocument({
          answer:
            'נולד בשכונה קטנה ליד הים',
        })

      mocks.findOne
        .mockResolvedValue(null)

      mocks.create
        .mockResolvedValue(
          createdDocument,
        )

      const result =
        await saveBiographyQuestionnaireAnswer(
          userId,
          memoryId,
          'birth_place_type',
          {
            customAnswer:
              '  נולד בשכונה קטנה ליד הים  ',
          },
        )

      expect(mocks.create)
        .toHaveBeenCalledWith(
          expect.objectContaining({
            answer:
              'נולד בשכונה קטנה ליד הים',
          }),
        )

      expect(result)
        .toMatchObject({
          answer:
            'נולד בשכונה קטנה ליד הים',
          selectedOptionKey: null,
        })
    })

    it('updates an existing answer and increments its revision', async () => {
      const existingDocument =
        createAnswerDocument({
          revision: 3,
        })

      mocks.findOne
        .mockResolvedValue(
          existingDocument,
        )

      const result =
        await saveBiographyQuestionnaireAnswer(
          userId,
          memoryId,
          'birth_place_type',
          {
            optionKey: 'village',
          },
        )

      expect(
        existingDocument.answer,
      ).toBe(
        'מושב, קיבוץ או כפר',
      )

      expect(
        existingDocument.revision,
      ).toBe(4)

      expect(
        existingDocument.save,
      ).toHaveBeenCalledOnce()

      expect(mocks.create)
        .not.toHaveBeenCalled()

      expect(result)
        .toMatchObject({
          answer:
            'מושב, קיבוץ או כפר',
          revision: 4,
          selectedOptionKey:
            'village',
        })
    })

    it('rejects an unknown question before authorization and database access', async () => {
      await expect(
        saveBiographyQuestionnaireAnswer(
          userId,
          memoryId,
          'unknown_question',
          {
            customAnswer:
              'תשובה כלשהי',
          },
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code:
          'BIOGRAPHY_QUESTION_NOT_FOUND',
      })

      expect(
        mocks.requireMemoryPermission,
      ).not.toHaveBeenCalled()

      expect(mocks.findOne)
        .not.toHaveBeenCalled()
    })

    it('rejects an option that does not belong to the question', async () => {
      await expect(
        saveBiographyQuestionnaireAnswer(
          userId,
          memoryId,
          'birth_place_type',
          {
            optionKey:
              'invalid_option',
          },
        ),
      ).rejects.toMatchObject({
        statusCode: 400,
        code:
          'BIOGRAPHY_OPTION_INVALID',
      })

      expect(
        mocks.requireMemoryPermission,
      ).not.toHaveBeenCalled()

      expect(mocks.findOne)
        .not.toHaveBeenCalled()
    })

    it('stops before reading answers when access is denied', async () => {
      mocks.requireMemoryPermission
        .mockRejectedValue(
          new Error('Access denied'),
        )

      await expect(
        getBiographyQuestionnaire(
          userId,
          memoryId,
        ),
      ).rejects.toThrow(
        'Access denied',
      )

      expect(mocks.find)
        .not.toHaveBeenCalled()
    })

    it('returns the configured question by key', () => {
      expect(
        getBiographyQuestion(
          'desired_legacy',
        ),
      ).toMatchObject({
        key: 'desired_legacy',
        category: 'values',
        options:
          expect.any(Array),
      })

      expect(
        getBiographyQuestion(
          'missing_question',
        ),
      ).toBeNull()
    })
  })
