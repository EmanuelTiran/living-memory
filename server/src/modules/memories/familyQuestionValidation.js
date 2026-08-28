import { z } from 'zod'

const objectIdPattern =
  /^[0-9a-f]{24}$/i

function objectIdSchema(label) {
  return z
    .string({
      error:
        `${label} must be a string.`,
    })
    .trim()
    .regex(objectIdPattern, {
      error:
        `${label} must be valid.`,
    })
}

export const createFamilyQuestionSchema =
  z.strictObject({
    question: z
      .string({
        error:
          'Family question must be a string.',
      })
      .trim()
      .min(5, {
        error:
          'Family question must contain at least 5 characters.',
      })
      .max(500, {
        error:
          'Family question must not exceed 500 characters.',
      }),
  })

export const familyQuestionMemoryParamsSchema =
  z.strictObject({
    memoryId:
      objectIdSchema('Memory ID'),
  })

export const familyQuestionParamsSchema =
  z.strictObject({
    memoryId:
      objectIdSchema('Memory ID'),

    questionId:
      objectIdSchema(
        'Family question ID',
      ),
  })
