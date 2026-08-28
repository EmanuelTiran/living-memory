import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  requireMemoryPermission:
    vi.fn(),
  findStories: vi.fn(),
  listGuidedStories: vi.fn(),
}))

vi.mock(
  '../src/modules/memories/memoryAccessService.js',
  () => ({
    MEMORY_PERMISSIONS: {
      VIEW: 'view',
    },
    requireMemoryPermission:
      mocks.requireMemoryPermission,
  }),
)

vi.mock(
  '../src/modules/memories/MemoryStory.js',
  () => ({
    default: {
      find: mocks.findStories,
    },
  }),
)

vi.mock(
  '../src/modules/media/guidedStoryService.js',
  () => ({
    listGuidedStories:
      mocks.listGuidedStories,
  }),
)

import {
  MEMORY_TIMELINE_ENTRY_LIMIT,
  listMemoryTimeline,
} from '../src/modules/memories/memoryTimelineService.js'

const userId =
  '507f1f77bcf86cd799439011'
const memoryId =
  '507f1f77bcf86cd799439012'

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

describe('Memory timeline service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireMemoryPermission
      .mockResolvedValue({})
    mocks.listGuidedStories
      .mockResolvedValue([])
  })

  it(
    'orders explicitly dated events and keeps other approved memories undated',
    async () => {
      const datedStoryId =
        '507f1f77bcf86cd799439013'
      const undatedStoryId =
        '507f1f77bcf86cd799439014'
      const recordingId =
        '507f1f77bcf86cd799439015'

      const query = createStoryQuery([
        {
          _id: undatedStoryId,
          title: 'סיפור בלי תאריך',
          content:
            'זהו סיפור מאושר שעדיין לא קיבל תאריך.',
          occurredOn: '',
          createdAt:
            new Date(
              '2026-08-21T10:00:00.000Z',
            ),
        },
        {
          _id: datedStoryId,
          title: 'המעבר לירושלים',
          content:
            'המשפחה עברה לירושלים בתחילת הקיץ.',
          occurredOn: '1978-06-01',
          createdAt:
            new Date(
              '2026-08-20T10:00:00.000Z',
            ),
        },
      ])

      mocks.findStories.mockReturnValue(
        query,
      )
      mocks.listGuidedStories
        .mockResolvedValue([
          {
            id:
              '507f1f77bcf86cd799439016',
            recordingId,
            title:
              'ארוחות השבת אצל סבתא',
            summary:
              'בכל שבת המשפחה התכנסה אצל סבתא.',
            recordedAt:
              new Date(
                '2026-08-22T10:00:00.000Z',
              ),
            approvedAt:
              new Date(
                '2026-08-23T10:00:00.000Z',
              ),
            canPlayOriginalAudio:
              true,
          },
        ])

      const result =
        await listMemoryTimeline(
          userId,
          memoryId,
        )

      expect(
        mocks.requireMemoryPermission,
      ).toHaveBeenCalledWith(
        userId,
        memoryId,
        'view',
      )
      expect(mocks.findStories)
        .toHaveBeenCalledWith({
          memoryId,
          status: 'approved',
        })
      expect(query.limit)
        .toHaveBeenCalledWith(
          MEMORY_TIMELINE_ENTRY_LIMIT,
        )

      expect(result.totalCount).toBe(3)
      expect(result.datedEntries)
        .toEqual([
          expect.objectContaining({
            id:
              `story:${datedStoryId}`,
            occurredOn:
              '1978-06-01',
            sourceType:
              'memory_story',
          }),
        ])
      expect(
        result.undatedEntries.map(
          (entry) => entry.id,
        ),
      ).toEqual([
        `recording:${recordingId}`,
        `story:${undatedStoryId}`,
      ])
      expect(result.undatedEntries[0])
        .toMatchObject({
          canPlayOriginalAudio:
            true,
          sourceRoute:
            `/app/memories/${memoryId}#recordings-title`,
        })
    },
  )

  it(
    'does not query timeline sources when view permission is denied',
    async () => {
      mocks.requireMemoryPermission
        .mockRejectedValue(
          new Error('access denied'),
        )

      await expect(
        listMemoryTimeline(
          userId,
          memoryId,
        ),
      ).rejects.toThrow(
        'access denied',
      )

      expect(mocks.findStories)
        .not.toHaveBeenCalled()
      expect(
        mocks.listGuidedStories,
      ).not.toHaveBeenCalled()
    },
  )
})
