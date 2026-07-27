import mongoose from 'mongoose'
import {
  describe,
  expect,
  it,
} from 'vitest'
import MemoryStory from '../src/modules/memories/MemoryStory.js'

function createStory(overrides = {}) {
  return new MemoryStory({
    memoryId:
      new mongoose.Types.ObjectId(),
    authorId:
      new mongoose.Types.ObjectId(),
    title: 'הטיול הראשון לירושלים',
    content:
      'זהו סיפור משפחתי שנשמר בתוך הזיכרון.',
    occurredOn: '1998-05-12',
    ...overrides,
  })
}

describe('MemoryStory model', () => {
  it('accepts a valid memory story', async () => {
    const story = createStory()

    await expect(
      story.validate(),
    ).resolves.toBeUndefined()

    expect(story.status).toBe('draft')
  })

  it('requires a story title', async () => {
    const story = createStory({
      title: '',
    })

    await expect(
      story.validate(),
    ).rejects.toMatchObject({
      name: 'ValidationError',
    })
  })

  it('requires meaningful story content', async () => {
    const story = createStory({
      content: 'קצר',
    })

    await expect(
      story.validate(),
    ).rejects.toMatchObject({
      name: 'ValidationError',
    })
  })

  it('rejects an invalid occurred date', async () => {
    const story = createStory({
      occurredOn: '2025-02-31',
    })

    await expect(
      story.validate(),
    ).rejects.toMatchObject({
      name: 'ValidationError',
    })
  })

  it('exposes a public id in JSON', () => {
    const story = createStory()
    const json = story.toJSON()

    expect(json.id).toBe(
      story._id.toString(),
    )

    expect(json._id).toBeUndefined()
  })
})