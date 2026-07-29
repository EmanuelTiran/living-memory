import { z } from 'zod'
import {
  BIOGRAPHY_ANSWER_MAX_LENGTH,
  BIOGRAPHY_QUESTION_MAX_LENGTH,
} from './MemoryBiographyAnswer.js'

const objectIdPattern =
  /^[0-9a-f]{24}$/i

const questionKeyPattern =
  /^[a-z][a-z0-9_]{2,79}$/

function objectIdSchema(label) {
  return z
    .string({
      error:
        `${label} must be a string.`,
    })
    .regex(objectIdPattern, {
      error:
        `${label} must be valid.`,
    })
}

const biographyQuestionSchema =
  z
    .string({
      error:
        'Biography question must be a string.',
    })
    .trim()
    .min(2, {
      error:
        'Biography question must contain at least 2 characters.',
    })
    .max(
      BIOGRAPHY_QUESTION_MAX_LENGTH,
      {
        error:
          `Biography question must not exceed ${BIOGRAPHY_QUESTION_MAX_LENGTH} characters.`,
      },
    )

const biographyAnswerSchema =
  z
    .string({
      error:
        'Biography answer must be a string.',
    })
    .trim()
    .min(1, {
      error:
        'Biography answer must not be empty.',
    })
    .max(
      BIOGRAPHY_ANSWER_MAX_LENGTH,
      {
        error:
          `Biography answer must not exceed ${BIOGRAPHY_ANSWER_MAX_LENGTH} characters.`,
      },
    )

const biographyQuestionKeySchema =
  z
    .string({
      error:
        'Biography question key must be a string.',
    })
    .trim()
    .regex(questionKeyPattern, {
      error:
        'Biography question key must be valid.',
    })

const biographyOptionKeySchema =
  z
    .string({
      error:
        'Biography option key must be a string.',
    })
    .trim()
    .regex(questionKeyPattern, {
      error:
        'Biography option key must be valid.',
    })

export const promoteCreativeChatReplySchema =
  z.strictObject({
    question:
      biographyQuestionSchema,

    answer:
      biographyAnswerSchema,
  })

export const saveBiographyQuestionnaireAnswerSchema =
  z.strictObject({
    questionKey:
      biographyQuestionKeySchema,

    question:
      biographyQuestionSchema,

    answer:
      biographyAnswerSchema,
  })

export const saveBiographyQuestionnaireResponseSchema =
  z.union([
    z.strictObject({
      optionKey:
        biographyOptionKeySchema,
    }),
    z.strictObject({
      customAnswer:
        biographyAnswerSchema,
    }),
  ])

export const updateBiographyAnswerSchema =
  z
    .strictObject({
      question:
        biographyQuestionSchema.optional(),

      answer:
        biographyAnswerSchema.optional(),
    })
    .refine(
      (data) =>
        Object.keys(data).length > 0,
      {
        error:
          'At least one biography field must be provided.',
      },
    )

export const biographyAnswerParamsSchema =
  z.strictObject({
    memoryId:
      objectIdSchema('Memory ID'),

    biographyAnswerId:
      objectIdSchema(
        'Biography answer ID',
      ),
  })

export const biographyQuestionnaireParamsSchema =
  z.strictObject({
    memoryId:
      objectIdSchema('Memory ID'),
  })

export const biographyQuestionnaireAnswerParamsSchema =
  z.strictObject({
    memoryId:
      objectIdSchema('Memory ID'),

    questionKey:
      biographyQuestionKeySchema,
  })

export const creativeChatPromotionParamsSchema =
  z.strictObject({
    memoryId:
      objectIdSchema('Memory ID'),

    messageId:
      objectIdSchema(
        'Chat message ID',
      ),
  })