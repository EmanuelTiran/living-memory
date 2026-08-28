import { z } from 'zod'
import {
  MAX_RECORDING_DURATION_MS,
  MAX_RECORDING_SIZE_BYTES,
  RECORDING_ALLOWED_USES,
  RECORDING_CONSENT_BASES,
  RECORDING_MIME_TYPES,
} from './MemoryRecording.js'

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

function isSafeOriginalFileName(
  value,
) {
  return Array.from(value).every(
    (character) => {
      const codePoint =
        character.codePointAt(0)

      const isControlCharacter =
        (codePoint >= 0 &&
          codePoint <= 31) ||
        codePoint === 127

      return (
        !isControlCharacter &&
        character !== '/' &&
        character !== '\\'
      )
    },
  )
}

const permittedUsesSchema = z
  .array(
    z.enum(
      RECORDING_ALLOWED_USES,
      {
        error:
          'Recording use is invalid.',
      },
    ),
    {
      error:
        'Permitted uses must be an array.',
    },
  )
  .min(1, {
    error:
      'Select at least one permitted recording use.',
  })
  .max(
    RECORDING_ALLOWED_USES.length,
    {
      error:
        'Too many permitted recording uses were provided.',
    },
  )
  .refine(
    (uses) =>
      new Set(uses).size ===
      uses.length,
    {
      error:
        'Permitted recording uses must be unique.',
    },
  )

export const createMemoryRecordingSchema =
  z.strictObject({
    displayName: z
      .string({
        error:
          'Recording name must be a string.',
      })
      .trim()
      .min(2, {
        error:
          'Recording name must contain at least 2 characters.',
      })
      .max(120, {
        error:
          'Recording name must not exceed 120 characters.',
      }),

    originalFileName: z
      .string({
        error:
          'Original file name must be a string.',
      })
      .trim()
      .min(1, {
        error:
          'Original file name must not be empty.',
      })
      .max(255, {
        error:
          'Original file name must not exceed 255 characters.',
      })
      .refine(
        isSafeOriginalFileName,
        {
          error:
            'Original file name contains invalid characters.',
        },
      ),

    mimeType: z.enum(
      RECORDING_MIME_TYPES,
      {
        error:
          'Recording file type is not supported.',
      },
    ),

    sizeBytes: z
      .number({
        error:
          'Recording size must be a number.',
      })
      .int({
        error:
          'Recording size must be an integer.',
      })
      .min(1, {
        error:
          'Recording file must not be empty.',
      })
      .max(
        MAX_RECORDING_SIZE_BYTES,
        {
          error:
            'Recording file must not exceed 25 MB.',
        },
      ),

    durationMs: z
      .number({
        error:
          'Recording duration must be a number.',
      })
      .int({
        error:
          'Recording duration must be an integer.',
      })
      .min(1, {
        error:
          'Recording duration must be positive.',
      })
      .max(
        MAX_RECORDING_DURATION_MS,
        {
          error:
            'Recording duration is too long.',
        },
      )
      .optional(),

    languageCode: z
      .string({
        error:
          'Recording language must be a string.',
      })
      .trim()
      .min(2, {
        error:
          'Recording language must contain at least 2 characters.',
      })
      .max(35, {
        error:
          'Recording language must not exceed 35 characters.',
      })
      .regex(
        /^[a-z]{2,3}(?:-[A-Z]{2})?$/,
        {
          error:
            'Recording language code is invalid.',
        },
      )
      .default('he'),

    checksumSha256: z
      .string({
        error:
          'Recording checksum must be a string.',
      })
      .trim()
      .toLowerCase()
      .regex(/^[a-f0-9]{64}$/, {
        error:
          'Recording checksum must be a SHA-256 value.',
      })
      .optional(),

    interviewPrompt: z
      .strictObject({
        questionKey: z
          .string({
            error:
              'Interview question key must be a string.',
          })
          .trim()
          .regex(
            /^[a-z][a-z0-9_]{2,79}$/,
            {
              error:
                'Interview question key must be valid.',
            },
          ),
      })
      .optional(),

    familyQuestionId:
      objectIdSchema(
        'Family question ID',
      ).optional(),

    consent: z.strictObject({
      confirmed: z.literal(true, {
        error:
          'Recording consent must be confirmed.',
      }),

      basis: z.enum(
        RECORDING_CONSENT_BASES,
        {
          error:
            'Recording consent basis is invalid.',
        },
      ),

      permittedUses:
        permittedUsesSchema,
    }),
  }).superRefine((value, context) => {
    if (
      value.consent.permittedUses.includes(
        'voice_imitation',
      ) &&
      value.consent.basis !== 'self'
    ) {
      context.addIssue({
        code: 'custom',
        path: [
          'consent',
          'basis',
        ],
        message:
          'Voice imitation is currently limited to the recorded person’s own voice.',
      })
    }

    if (
      value.interviewPrompt &&
      value.familyQuestionId
    ) {
      context.addIssue({
        code: 'custom',
        path: ['familyQuestionId'],
        message:
          'A recording can answer only one prompt source.',
      })
    }
  })

export const memoryRecordingMemoryParamsSchema =
  z.strictObject({
    memoryId:
      objectIdSchema('Memory ID'),
  })

export const memoryRecordingParamsSchema =
  z.strictObject({
    memoryId:
      objectIdSchema('Memory ID'),

    recordingId:
      objectIdSchema('Recording ID'),
  })
