import mongoose from 'mongoose'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  findStories: vi.fn(),
}))

vi.mock(
  '../src/modules/memories/MemoryStory.js',
  () => ({
    default: {
      find: mocks.findStories,
    },
  }),
)

import {
  APPROVED_SOURCE_CONTENT_MAX_LENGTH,
  createApprovedSource,
} from '../src/modules/chat/approvedSource.js'
import {
  APPROVED_STORY_CANDIDATE_LIMIT,
  listApprovedStorySources,
} from '../src/modules/chat/approvedStorySourceProvider.js'

const memoryId =
  '507f1f77bcf86cd799439011'

function createStoryQuery(stories) {
  const query = {
    sort: vi.fn(),
    limit: vi.fn(),
    select: vi.fn(),
    lean: vi.fn(),
  }

  query.sort.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  query.select.mockReturnValue(query)
  query.lean.mockResolvedValue(stories)

  return query
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Approved source contract', () => {
  it('normalizes and bounds untrusted source content', () => {
    const unsafeCharacter =
      String.fromCharCode(0)

    const source = createApprovedSource({
      sourceType: 'memory_story',
      sourceId:
        new mongoose.Types.ObjectId()
          .toString(),
      title: 'Approved story',
      content:
        `Safe${unsafeCharacter}content` +
        'a'.repeat(
          APPROVED_SOURCE_CONTENT_MAX_LENGTH,
        ),
      approvedAt: null,
      sourceVersion:
        '2026-07-27T10:00:00.000Z',
    })

    expect(source.content).not.toContain(
      unsafeCharacter,
    )

    expect(
      source.content.length,
    ).toBeLessThanOrEqual(
      APPROVED_SOURCE_CONTENT_MAX_LENGTH,
    )
  })

  it('requires approval metadata or a source version', () => {
    expect(() =>
      createApprovedSource({
        sourceType: 'memory_story',
        sourceId:
          new mongoose.Types.ObjectId()
            .toString(),
        title: 'Unversioned story',
        content:
          'This source has no approval metadata.',
        approvedAt: null,
        sourceVersion: '',
      }),
    ).toThrow()
  })
})

describe('Approved story source provider', () => {
  it('queries approved stories and maps them to generic sources', async () => {
    const storyId =
      new mongoose.Types.ObjectId()

    const updatedAt =
      new Date(
        '2026-07-27T10:00:00.000Z',
      )

    const query = createStoryQuery([
      {
        _id: storyId,
        title: 'הטיול לירושלים',
        content:
          'המשפחה נסעה יחד לירושלים.',
        updatedAt,
      },
    ])

    mocks.findStories.mockReturnValue(query)

    const result =
      await listApprovedStorySources(
        memoryId,
        {
          limit: 10,
        },
      )

    expect(
      mocks.findStories,
    ).toHaveBeenCalledWith({
      memoryId,
      status: 'approved',
    })

    expect(query.sort).toHaveBeenCalledWith({
      updatedAt: -1,
    })

    expect(query.limit).toHaveBeenCalledWith(
      10,
    )

    expect(query.select).toHaveBeenCalledWith({
      _id: 1,
      title: 1,
      content: 1,
      updatedAt: 1,
    })

    expect(result).toEqual([
      {
        sourceType: 'memory_story',
        sourceId: storyId.toString(),
        title: 'הטיול לירושלים',
        content:
          'המשפחה נסעה יחד לירושלים.',
        approvedAt: null,
        sourceVersion:
          updatedAt.toISOString(),
      },
    ])
  })

  it('caps the number of database candidates', async () => {
    const query = createStoryQuery([])

    mocks.findStories.mockReturnValue(query)

    await listApprovedStorySources(
      memoryId,
      {
        limit: 1000,
      },
    )

    expect(query.limit).toHaveBeenCalledWith(
      APPROVED_STORY_CANDIDATE_LIMIT,
    )
  })
})