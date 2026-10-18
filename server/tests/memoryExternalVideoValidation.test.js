import { describe, expect, it } from 'vitest'
import { normalizeYouTubeVideo } from '../../shared/youtubeVideo.js'
import { externalVideoInputSchema } from '../src/modules/media/memoryExternalVideoValidation.js'
import MemoryExternalVideo from '../src/modules/media/MemoryExternalVideo.js'

const id = 'rCY43S8GGAY'
describe('YouTube references', () => {
  it.each([
    [`https://www.youtube.com/watch?v=${id}`, 0],
    [`https://youtube.com/watch?v=${id}&t=55s&si=tracking`, 55],
    [`https://youtu.be/${id}?t=1m5s`, 65],
    [`https://m.youtube.com/watch?v=${id}&start=3600`, 3600],
    [`https://youtu.be/${id}#t=2m`, 120],
  ])('normalizes %s', (url, startSeconds) => {
    expect(normalizeYouTubeVideo(url)).toEqual({
      provider: 'youtube', externalId: id, startSeconds,
      canonicalUrl: `https://www.youtube.com/watch?v=${id}${startSeconds ? `&t=${startSeconds}s` : ''}`,
    })
  })
  it.each([
    'javascript:alert(1)', 'data:text/html,<script>alert(1)</script>',
    `<iframe src="https://www.youtube.com/watch?v=${id}"></iframe>`,
    'https://vimeo.com/1234', 'https://example.com/video.mp4',
    `https://youtube.com.evil.test/watch?v=${id}`, `https://youtube.com@evil.test/watch?v=${id}`,
    `https://evil@youtube.com/watch?v=${id}`, `http://youtube.com/watch?v=${id}`,
    `https://youtube.com:444/watch?v=${id}`, `https://youtube.com/redirect?q=${id}`,
    `https://youtube.com/watch?v=${id}&v=aaaaaaaaaaa`, `https://youtu.be/${id}/bad`,
    `https://youtube.com/watch?v=${id}&t=-1`, `https://youtube.com/watch?v=${id}&t=NaN`,
    `https://youtube.com/watch?v=${id}&t=99999999999999999999`,
    `https://youtube.com/watch?v=${id}&t=1&t=2`, `https://youtube.com/watch?v=${id}\n&x=1`,
    'https://youtube.com/watch?v=too-short', 'not a URL',
  ])('rejects unsafe, malformed or unsupported reference %s', url => {
    expect(normalizeYouTubeVideo(url)).toBeNull()
    expect(externalVideoInputSchema.safeParse({ url, displayName: 'Family video' }).success).toBe(false)
  })
  it('accepts only the declared metadata, never embed HTML or ownership fields', () => {
    const input = { url: `https://youtu.be/${id}`, displayName: 'Family video' }
    expect(externalVideoInputSchema.safeParse(input).success).toBe(true)
    for (const extra of [{ embed: '<iframe />' }, { addedByUserId: 'another-user' }, { provider: 'vimeo' }]) {
      expect(externalVideoInputSchema.safeParse({ ...input, ...extra }).success).toBe(false)
    }
  })
})

describe('External video model', () => {
  const reference = normalizeYouTubeVideo(`https://youtu.be/${id}?t=55s`)
  const data = { ...reference, displayName: 'Family video', memoryId: '507f1f77bcf86cd799439011', addedByUserId: '507f1f77bcf86cd799439010' }
  it('validates a structured reference without file storage or processing metadata', async () => {
    const video = new MemoryExternalVideo(data)
    await expect(video.validate()).resolves.toBeUndefined()
    expect(video.toJSON()).toEqual(expect.objectContaining({ provider: 'youtube', startSeconds: 55 }))
    expect(video.toJSON()).not.toHaveProperty('addedByUserId')
    expect(video.toJSON()).not.toHaveProperty('storageKey')
  })
  it('rejects mismatched URL/ID/timestamp and invalid archive state', async () => {
    for (const change of [{ canonicalUrl: 'javascript:alert(1)' }, { externalId: 'aaaaaaaaaaa' }, { startSeconds: 20 }, { lifecycleStatus: 'archived' }]) {
      await expect(new MemoryExternalVideo({ ...data, ...change }).validate()).rejects.toThrow()
    }
  })
})
