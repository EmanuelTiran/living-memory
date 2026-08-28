import { z } from 'zod'

const objectIdPattern =
  /^[0-9a-f]{24}$/i

function objectIdSchema(label) {
  return z
    .string({
      error: `${label} must be a string.`,
    })
    .trim()
    .regex(objectIdPattern, {
      error: `${label} must be valid.`,
    })
}

function isSafeOriginalFileName(value) {
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

export const memoryAssetMetadataSchema =
  z.strictObject({
    displayName: z
      .string({
        error:
          'Asset name must be a string.',
      })
      .trim()
      .min(2, {
        error:
          'Asset name must contain at least 2 characters.',
      })
      .max(120, {
        error:
          'Asset name must not exceed 120 characters.',
      }),

    description: z
      .string({
        error:
          'Asset description must be a string.',
      })
      .trim()
      .max(500, {
        error:
          'Asset description must not exceed 500 characters.',
      })
      .default(''),
  })

export const updateMemoryAssetMetadataSchema =
  memoryAssetMetadataSchema

export const memoryAssetAccessLinkSchema =
  z.strictObject({
    disposition: z.enum([
      'inline',
      'attachment',
    ], {
      error:
        'Asset access disposition is invalid.',
    }),
  })

export const memoryAssetAccessQuerySchema =
  z.strictObject({
    token: z
      .string({
        error:
          'Asset access token must be a string.',
      })
      .min(20, {
        error:
          'Asset access token is invalid.',
      })
      .max(1000, {
        error:
          'Asset access token is invalid.',
      })
      .regex(
        /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
        {
          error:
            'Asset access token is invalid.',
        },
      ),
  })

export const memoryAssetFileNameSchema =
  z
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
    .refine(isSafeOriginalFileName, {
      error:
        'Original file name contains invalid characters.',
    })

export const memoryAssetMemoryParamsSchema =
  z.strictObject({
    memoryId:
      objectIdSchema('Memory ID'),
  })

export const memoryAssetParamsSchema =
  z.strictObject({
    memoryId:
      objectIdSchema('Memory ID'),
    assetId:
      objectIdSchema('Asset ID'),
  })
