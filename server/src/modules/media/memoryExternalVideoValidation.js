import { z } from 'zod'
import { normalizeYouTubeVideo } from '../../../../shared/youtubeVideo.js'
import { memoryAssetMemoryParamsSchema, memoryAssetMetadataSchema } from './memoryAssetValidation.js'

export const externalVideoInputSchema = memoryAssetMetadataSchema.extend({
  url: z.string().max(2048).transform((value, context) => {
    const video = normalizeYouTubeVideo(value)
    if (!video) {
      context.addIssue({ code: 'custom', message: 'Use a valid HTTPS YouTube watch or youtu.be video link.' })
      return z.NEVER
    }
    return video
  }),
})

export const externalVideoParamsSchema = memoryAssetMemoryParamsSchema.extend({
  externalVideoId: z.string().regex(/^[0-9a-f]{24}$/i),
})
