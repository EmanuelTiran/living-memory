import {
    describe,
    expect,
    it,
  } from 'vitest'
  import {
    BIOGRAPHY_ANSWER_MAX_LENGTH,
    BIOGRAPHY_QUESTION_MAX_LENGTH,
  } from '../src/modules/memories/MemoryBiographyAnswer.js'
  import {
    biographyAnswerParamsSchema,
    creativeChatPromotionParamsSchema,
    promoteCreativeChatReplySchema,
    saveBiographyQuestionnaireAnswerSchema,
    updateBiographyAnswerSchema,
  } from '../src/modules/memories/biographyValidation.js'

  const memoryId =
    '507f1f77bcf86cd799439010'

  const messageId =
    '507f1f77bcf86cd799439011'

  const biographyAnswerId =
    '507f1f77bcf86cd799439012'

  describe('Biography validation', () => {
    it('normalizes creative-chat promotion input', () => {
      const result =
        promoteCreativeChatReplySchema.parse({
          question:
            '  What was her favorite color?  ',
          answer:
            '  She may have preferred blue.  ',
        })

      expect(result).toEqual({
        question:
          'What was her favorite color?',
        answer:
          'She may have preferred blue.',
      })
    })

    it('rejects empty and oversized promotion content', () => {
      expect(() =>
        promoteCreativeChatReplySchema.parse({
          question: ' ',
          answer: 'Valid answer',
        }),
      ).toThrow()

      expect(() =>
        promoteCreativeChatReplySchema.parse({
          question: 'Valid question',
          answer: ' ',
        }),
      ).toThrow()

      expect(() =>
        promoteCreativeChatReplySchema.parse({
          question:
            'q'.repeat(
              BIOGRAPHY_QUESTION_MAX_LENGTH +
                1,
            ),
          answer: 'Valid answer',
        }),
      ).toThrow()

      expect(() =>
        promoteCreativeChatReplySchema.parse({
          question: 'Valid question',
          answer:
            'a'.repeat(
              BIOGRAPHY_ANSWER_MAX_LENGTH +
                1,
            ),
        }),
      ).toThrow()
    })

    it('normalizes a questionnaire answer', () => {
      const result =
        saveBiographyQuestionnaireAnswerSchema
          .parse({
            questionKey:
              '  birth_place  ',
            question:
              '  Where was this person born?  ',
            answer: '  Jerusalem  ',
          })

      expect(result).toEqual({
        questionKey: 'birth_place',
        question:
          'Where was this person born?',
        answer: 'Jerusalem',
      })
    })

    it('rejects an invalid questionnaire key', () => {
      expect(() =>
        saveBiographyQuestionnaireAnswerSchema
          .parse({
            questionKey:
              'Birth Place!',
            question:
              'Where was this person born?',
            answer: 'Jerusalem',
          }),
      ).toThrow()
    })

    it('requires at least one editable field', () => {
      expect(() =>
        updateBiographyAnswerSchema.parse(
          {},
        ),
      ).toThrow()

      expect(
        updateBiographyAnswerSchema.parse({
          answer:
            '  Updated answer  ',
        }),
      ).toEqual({
        answer: 'Updated answer',
      })
    })

    it('validates biography and promotion identifiers', () => {
      expect(
        biographyAnswerParamsSchema.parse({
          memoryId,
          biographyAnswerId,
        }),
      ).toEqual({
        memoryId,
        biographyAnswerId,
      })

      expect(
        creativeChatPromotionParamsSchema
          .parse({
            memoryId,
            messageId,
          }),
      ).toEqual({
        memoryId,
        messageId,
      })

      expect(() =>
        creativeChatPromotionParamsSchema
          .parse({
            memoryId: 'invalid',
            messageId,
          }),
      ).toThrow()
    })
  })
