import { z } from 'zod'

export const qrTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32}$/)
export const qrParamsSchema = z.strictObject({ token: qrTokenSchema })
export const publicPhotoParamsSchema = qrParamsSchema.extend({
  photo: z.string().regex(/^[a-f0-9]{32}$/),
})
const selection = z.array(z.strictObject({
  sourceId: z.string().regex(/^[a-f0-9]{24}$/i),
  version: z.string().regex(/^[a-f0-9]{64}$/),
})).max(12).refine((items) => new Set(items.map((item) => item.sourceId)).size === items.length)

export const qrActionSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('initialize') }),
  z.strictObject({ action: z.literal('set_enabled'), enabled: z.boolean(), confirmed: z.literal(true) }),
  z.strictObject({ action: z.literal('unpublish'), confirmed: z.literal(true) }),
  z.strictObject({
    action: z.literal('publish'),
    confirmed: z.literal(true),
    profileVersion: z.string().regex(/^[a-f0-9]{64}$/),
    stories: selection,
    photos: selection,
  }),
])
