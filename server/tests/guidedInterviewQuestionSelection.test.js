import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  BIOGRAPHY_QUESTIONS,
} from '../src/modules/memories/biographyQuestionCatalog.js'
import {
  createQuestionnaireResult,
} from '../src/modules/memories/biographyService.js'

describe(
  'guided interview question selection',
  () => {
    it(
      'does not automatically offer a question with a stored voice answer',
      () => {
        const answeredQuestion =
          BIOGRAPHY_QUESTIONS[0]

        const result =
          createQuestionnaireResult(
            [],
            [answeredQuestion.key],
          )

        expect(
          result.questions.some(
            (question) =>
              question.key ===
              answeredQuestion.key,
          ),
        ).toBe(false)

        expect(
          result.unansweredQuestions.some(
            (question) =>
              question.key ===
              answeredQuestion.key,
          ),
        ).toBe(false)

        expect(
          result.answeredQuestions,
        ).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              key: answeredQuestion.key,
              question:
                answeredQuestion.question,
            }),
          ]),
        )

        expect(
          result.progress.completedCount,
        ).toBe(1)

        expect(
          result.unansweredQuestions,
        ).toHaveLength(
          BIOGRAPHY_QUESTIONS.length - 1,
        )
      },
    )

    it(
      'counts repeated recordings and written answers once per question',
      () => {
        const voiceQuestion =
          BIOGRAPHY_QUESTIONS[0]

        const writtenQuestion =
          BIOGRAPHY_QUESTIONS[1]

        const result =
          createQuestionnaireResult(
            [
              {
                id: 'answer-1',
                questionKey:
                  writtenQuestion.key,
                question:
                  writtenQuestion.question,
                answer:
                  writtenQuestion.options[0]
                    .label,
                status: 'approved',
              },
            ],
            [
              voiceQuestion.key,
              voiceQuestion.key,
              writtenQuestion.key,
            ],
          )

        expect(
          result.progress.completedCount,
        ).toBe(2)

        expect(
          result.answeredQuestions.map(
            (question) => question.key,
          ),
        ).toEqual(
          expect.arrayContaining([
            voiceQuestion.key,
            writtenQuestion.key,
          ]),
        )
      },
    )
  },
)
