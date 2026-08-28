import { z } from 'zod'

export const ARCHIVE_SEARCH_SOURCE_TYPES =
  Object.freeze([
    'all',
    'memory_profile',
    'biography_answer',
    'memory_story',
    'recording_transcript',
  ])

export const ARCHIVE_SEARCH_AUDIO_FILTERS =
  Object.freeze([
    'all',
    'playable',
  ])

export const archiveSearchQuerySchema =
  z.strictObject({
    q: z
      .string({
        error:
          'Archive search query must be a string.',
      })
      .trim()
      .max(120, {
        error:
          'Archive search query must not exceed 120 characters.',
      })
      .default(''),

    sourceType: z
      .enum(
        ARCHIVE_SEARCH_SOURCE_TYPES,
        {
          error:
            'Archive source type filter is invalid.',
        },
      )
      .default('all'),

    audioFilter: z
      .enum(
        ARCHIVE_SEARCH_AUDIO_FILTERS,
        {
          error:
            'Archive audio filter is invalid.',
        },
      )
      .default('all'),

    limit: z.coerce
      .number({
        error:
          'Archive search limit must be a number.',
      })
      .int({
        error:
          'Archive search limit must be an integer.',
      })
      .min(1, {
        error:
          'Archive search limit must be at least 1.',
      })
      .max(50, {
        error:
          'Archive search limit must not exceed 50.',
      })
      .default(30),
  })
