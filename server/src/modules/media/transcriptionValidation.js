import { z } from 'zod'
import {
  RECORDING_TRANSCRIPT_MAX_LENGTH,
} from './MemoryRecordingTranscript.js'

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

const languageCodeSchema = z
  .string({
    error:
      'Transcript language must be a string.',
  })
  .trim()
  .min(2, {
    error:
      'Transcript language must contain at least 2 characters.',
  })
  .max(35, {
    error:
      'Transcript language must not exceed 35 characters.',
  })
  .regex(
    /^[a-z]{2,3}(?:-[A-Z]{2})?$/,
    {
      error:
        'Transcript language code is invalid.',
    },
  )

const expectedRevisionSchema = z
  .number({
    error:
      'Expected transcript revision must be a number.',
  })
  .int({
    error:
      'Expected transcript revision must be an integer.',
  })
  .min(1, {
    error:
      'Expected transcript revision must be positive.',
  })

export const requestMemoryRecordingTranscriptionSchema =
  z.strictObject({
    languageCode:
      languageCodeSchema.optional(),
  })

export const updateMemoryRecordingTranscriptSchema =
  z.strictObject({
    content: z
      .string({
        error:
          'Transcript content must be a string.',
      })
      .trim()
      .min(1, {
        error:
          'Transcript content must not be empty.',
      })
      .max(
        RECORDING_TRANSCRIPT_MAX_LENGTH,
        {
          error:
            `Transcript content must not exceed ${RECORDING_TRANSCRIPT_MAX_LENGTH} characters.`,
        },
      ),

    expectedRevision:
      expectedRevisionSchema,
  })

export const approveMemoryRecordingTranscriptSchema =
  z.strictObject({
    expectedRevision:
      expectedRevisionSchema,

    confirmSourceUse:
      z.literal(true, {
        error:
          'Transcript source use must be explicitly confirmed.',
      }),
  })

export const memoryRecordingTranscriptionParamsSchema =
  z.strictObject({
    memoryId:
      objectIdSchema('Memory ID'),

    recordingId:
      objectIdSchema('Recording ID'),
  })

export const memoryRecordingTranscriptParamsSchema =
  z.strictObject({
    memoryId:
      objectIdSchema('Memory ID'),

    recordingId:
      objectIdSchema('Recording ID'),

    transcriptId:
      objectIdSchema('Transcript ID'),
  })