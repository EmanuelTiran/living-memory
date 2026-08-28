import { z } from 'zod'

function optionalTextSchema({
  maxLength,
  typeMessage,
  lengthMessage,
}) {
  return z
    .string({
      error: typeMessage,
    })
    .trim()
    .max(maxLength, {
      error: lengthMessage,
    })
    .transform((value) =>
      value.length > 0 ? value : undefined,
    )
    .optional()
}

function editableTextSchema({
  maxLength,
  typeMessage,
  lengthMessage,
}) {
  return z
    .string({
      error: typeMessage,
    })
    .trim()
    .max(maxLength, {
      error: lengthMessage,
    })
    .optional()
}

function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value
    .split('-')
    .map(Number)

  const date = new Date(
    Date.UTC(year, month - 1, day),
  )

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

const subjectNameSchema = z
  .string({
    error:
      'Subject name must be a string.',
  })
  .trim()
  .min(2, {
    error:
      'Subject name must contain at least 2 characters.',
  })
  .max(100, {
    error:
      'Subject name must not exceed 100 characters.',
  })

const storyTitleSchema = z
  .string({
    error:
      'Story title must be a string.',
  })
  .trim()
  .min(2, {
    error:
      'Story title must contain at least 2 characters.',
  })
  .max(160, {
    error:
      'Story title must not exceed 160 characters.',
  })

const storyContentSchema = z
  .string({
    error:
      'Story content must be a string.',
  })
  .trim()
  .min(10, {
    error:
      'Story content must contain at least 10 characters.',
  })
  .max(20000, {
    error:
      'Story content must not exceed 20000 characters.',
  })

const optionalDateOnlySchema = z
  .string({
    error:
      'Occurred date must be a string.',
  })
  .trim()
  .transform((value) =>
    value.length > 0 ? value : undefined,
  )
  .refine(
    (value) =>
      value === undefined ||
      isValidDateOnly(value),
    {
      error:
        'Occurred date must be a valid date in YYYY-MM-DD format.',
    },
  )
  .optional()

const editableDateOnlySchema = z
  .string({
    error:
      'Occurred date must be a string.',
  })
  .trim()
  .refine(
    (value) =>
      value.length === 0 ||
      isValidDateOnly(value),
    {
      error:
        'Occurred date must be a valid date in YYYY-MM-DD format.',
    },
  )
  .optional()

export const createMemoryProfileSchema =
  z.strictObject({
    subjectName: subjectNameSchema,

    relationship: optionalTextSchema({
      maxLength: 80,
      typeMessage:
        'Relationship must be a string.',
      lengthMessage:
        'Relationship must not exceed 80 characters.',
    }),

    description: optionalTextSchema({
      maxLength: 1000,
      typeMessage:
        'Description must be a string.',
      lengthMessage:
        'Description must not exceed 1000 characters.',
    }),
  })

export const updateMemoryProfileSchema =
  z
    .strictObject({
      subjectName:
        subjectNameSchema.optional(),

      relationship: editableTextSchema({
        maxLength: 80,
        typeMessage:
          'Relationship must be a string.',
        lengthMessage:
          'Relationship must not exceed 80 characters.',
      }),

      description: editableTextSchema({
        maxLength: 1000,
        typeMessage:
          'Description must be a string.',
        lengthMessage:
          'Description must not exceed 1000 characters.',
      }),
    })
    .refine(
      (data) =>
        Object.keys(data).length > 0,
      {
        error:
          'At least one memory profile field must be provided.',
      },
    )

export const createMemoryStorySchema =
  z.strictObject({
    title: storyTitleSchema,
    content: storyContentSchema,
    occurredOn: optionalDateOnlySchema,
  })

export const updateMemoryStorySchema =
  z
    .strictObject({
      expectedRevision: z
        .number({
          error:
            'Expected story revision must be a number.',
        })
        .int({
          error:
            'Expected story revision must be an integer.',
        })
        .positive({
          error:
            'Expected story revision must be positive.',
        })
        .optional(),
      title: storyTitleSchema.optional(),
      content:
        storyContentSchema.optional(),
      occurredOn: editableDateOnlySchema,
    })
    .refine(
      (data) =>
        Object.keys(data).some(
          (key) =>
            key !== 'expectedRevision',
        ),
      {
        error:
          'At least one story field must be provided.',
      },
    )

export const memoryProfileParamsSchema =
  z.strictObject({
    memoryId: z
      .string({
        error:
          'Memory ID must be a string.',
      })
      .regex(/^[0-9a-f]{24}$/i, {
        error: 'Memory ID must be valid.',
      }),
  })

export const memoryStoryParamsSchema =
  z.strictObject({
    memoryId: z
      .string({
        error:
          'Memory ID must be a string.',
      })
      .regex(/^[0-9a-f]{24}$/i, {
        error: 'Memory ID must be valid.',
      }),

    storyId: z
      .string({
        error:
          'Story ID must be a string.',
      })
      .regex(/^[0-9a-f]{24}$/i, {
        error: 'Story ID must be valid.',
      }),
  })
