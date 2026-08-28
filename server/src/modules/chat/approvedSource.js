import { z } from 'zod'

export const APPROVED_SOURCE_CONTENT_MAX_LENGTH =
  6000

const approvedSourceSchema = z
  .strictObject({
    sourceType: z
      .string({
        error:
          'Source type must be a string.',
      })
      .trim()
      .min(1, {
        error:
          'Source type must not be empty.',
      })
      .max(50, {
        error:
          'Source type must not exceed 50 characters.',
      })
      .regex(/^[a-z][a-z0-9_]*$/, {
        error:
          'Source type must use lowercase letters, numbers, and underscores.',
      }),

    sourceId: z
      .string({
        error:
          'Source ID must be a string.',
      })
      .trim()
      .min(1, {
        error:
          'Source ID must not be empty.',
      })
      .max(100, {
        error:
          'Source ID must not exceed 100 characters.',
      }),

    title: z
      .string({
        error:
          'Source title must be a string.',
      })
      .trim()
      .min(1, {
        error:
          'Source title must not be empty.',
      })
      .max(200, {
        error:
          'Source title must not exceed 200 characters.',
      }),

    content: z
      .string({
        error:
          'Source content must be a string.',
      })
      .trim()
      .min(1, {
        error:
          'Source content must not be empty.',
      })
      .max(
        APPROVED_SOURCE_CONTENT_MAX_LENGTH,
        {
          error:
            `Source content must not exceed ${APPROVED_SOURCE_CONTENT_MAX_LENGTH} characters.`,
        },
      ),

    approvedAt: z
      .date({
        error:
          'Source approval timestamp must be a date.',
      })
      .nullable()
      .default(null),

    sourceVersion: z
      .string({
        error:
          'Source version must be a string.',
      })
      .trim()
      .max(100, {
        error:
          'Source version must not exceed 100 characters.',
      })
      .default(''),

    sourceRoute: z
      .string({
        error:
          'Source route must be a string.',
      })
      .trim()
      .max(500, {
        error:
          'Source route must not exceed 500 characters.',
      })
      .startsWith('/app/memories/', {
        error:
          'Source route must point to a memory profile.',
      })
      .optional(),

    recordingId: z
      .string({
        error:
          'Recording ID must be a string.',
      })
      .trim()
      .regex(/^[0-9a-f]{24}$/i, {
        error:
          'Recording ID must be valid.',
      })
      .optional(),

    recordedAt: z
      .date({
        error:
          'Recording timestamp must be a date.',
      })
      .nullable()
      .optional(),

    canPlayOriginalAudio: z
      .boolean({
        error:
          'Original audio availability must be a boolean.',
      })
      .optional(),
  })
  .refine(
    (source) =>
      source.approvedAt !== null ||
      source.sourceVersion.length > 0,
    {
      error:
        'An approved source requires an approval timestamp or source version.',
      path: ['sourceVersion'],
    },
  )

function removeUnsafeControlCharacters(
  value,
) {
  if (typeof value !== 'string') {
    return value
  }

  return Array.from(value, (character) => {
    const codePoint =
      character.codePointAt(0)

    const isUnsafeControlCharacter =
      (codePoint >= 0 && codePoint <= 8) ||
      codePoint === 11 ||
      codePoint === 12 ||
      (codePoint >= 14 &&
        codePoint <= 31) ||
      codePoint === 127

    return isUnsafeControlCharacter
      ? ' '
      : character
  }).join('')
}

function normalizeSourceContent(content) {
  if (typeof content !== 'string') {
    return content
  }

  return removeUnsafeControlCharacters(
    content,
  )
    .slice(
      0,
      APPROVED_SOURCE_CONTENT_MAX_LENGTH,
    )
    .trim()
}

export function createApprovedSource(input) {
  const source = approvedSourceSchema.parse({
    ...input,
    content: normalizeSourceContent(
      input?.content,
    ),
  })

  return Object.freeze(source)
}