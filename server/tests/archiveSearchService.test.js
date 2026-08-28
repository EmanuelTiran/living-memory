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

import {
  ARCHIVE_SEARCH_CANDIDATE_LIMIT,
  searchMemoryArchive,
} from '../src/modules/memories/archiveSearchService.js'

const userId =
  '507f1f77bcf86cd799439011'
const memoryId =
  '507f1f77bcf86cd799439012'

function createProvider(sources) {
  return {
    listApprovedSources: vi
      .fn()
      .mockResolvedValue(sources),
  }
}

function createSource({
  sourceType,
  sourceId,
  title,
  content,
  approvedAt = null,
  sourceVersion =
    '2026-08-23T10:00:00.000Z',
  sourceRoute,
  recordingId,
  recordedAt,
  canPlayOriginalAudio,
}) {
  return {
    sourceType,
    sourceId,
    title,
    content,
    approvedAt,
    sourceVersion,
    ...(sourceRoute
      ? { sourceRoute }
      : {}),
    ...(recordingId
      ? { recordingId }
      : {}),
    ...(recordedAt
      ? { recordedAt }
      : {}),
    ...(typeof canPlayOriginalAudio ===
    'boolean'
      ? { canPlayOriginalAudio }
      : {}),
  }
}

describe('Archive search service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireMemoryPermission
      .mockResolvedValue({})
  })

  it(
    'searches only supplied approved sources and ranks matching content',
    async () => {
      const story = createSource({
        sourceType: 'memory_story',
        sourceId:
          '507f1f77bcf86cd799439013',
        title: 'הטיול לירושלים',
        content:
          'המשפחה טיילה יחד בעיר העתיקה בירושלים.',
        sourceRoute:
          `/app/memories/${memoryId}#stories-title`,
      })

      const biography = createSource({
        sourceType:
          'biography_answer',
        sourceId:
          '507f1f77bcf86cd799439014',
        title: 'המקצוע',
        content:
          'היא עבדה כמורה בבית ספר.',
        approvedAt:
          new Date(
            '2026-08-22T10:00:00.000Z',
          ),
        sourceVersion: 'revision:1',
      })

      const provider = createProvider([
        biography,
        story,
      ])

      const result =
        await searchMemoryArchive(
          userId,
          memoryId,
          {
            q: 'ירושלים',
            sourceType:
              'memory_story',
          },
          {
            sourceProviders: [
              provider,
            ],
          },
        )

      expect(
        mocks.requireMemoryPermission,
      ).toHaveBeenCalledWith(
        userId,
        memoryId,
        'view',
      )
      expect(provider.listApprovedSources)
        .toHaveBeenCalledWith(
          memoryId,
          {
            limit:
              ARCHIVE_SEARCH_CANDIDATE_LIMIT,
          },
        )
      expect(result).toMatchObject({
        query: 'ירושלים',
        filters: {
          sourceType: 'memory_story',
          audioFilter: 'all',
        },
        total: 1,
      })
      expect(result.results).toEqual([
        expect.objectContaining({
          sourceType: 'memory_story',
          sourceId: story.sourceId,
          title: story.title,
          sourceRoute:
            story.sourceRoute,
        }),
      ])
      expect(result.results[0])
        .not.toHaveProperty('score')
    },
  )

  it(
    'filters for recordings with explicit playback permission',
    async () => {
      const playableRecording =
        createSource({
          sourceType:
            'recording_transcript',
          sourceId:
            '507f1f77bcf86cd799439015',
          title:
            'תמלול מאושר: ארוחת שבת',
          content:
            'בכל שבת המשפחה נפגשה אצל סבתא.',
          approvedAt:
            new Date(
              '2026-08-23T10:00:00.000Z',
            ),
          sourceVersion:
            'revision:1:chunk:1',
          recordingId:
            '507f1f77bcf86cd799439016',
          recordedAt:
            new Date(
              '2026-08-21T10:00:00.000Z',
            ),
          canPlayOriginalAudio:
            true,
        })

      const textOnlyRecording =
        createSource({
          sourceType:
            'recording_transcript',
          sourceId:
            '507f1f77bcf86cd799439017',
          title:
            'תמלול מאושר: בית הספר',
          content:
            'היא סיפרה על בית הספר.',
          approvedAt:
            new Date(
              '2026-08-22T10:00:00.000Z',
            ),
          sourceVersion:
            'revision:1:chunk:1',
          recordingId:
            '507f1f77bcf86cd799439018',
          canPlayOriginalAudio:
            false,
        })

      const result =
        await searchMemoryArchive(
          userId,
          memoryId,
          {
            audioFilter: 'playable',
          },
          {
            sourceProviders: [
              createProvider([
                textOnlyRecording,
                playableRecording,
              ]),
            ],
          },
        )

      expect(result.total).toBe(1)
      expect(result.results[0])
        .toMatchObject({
          recordingId:
            playableRecording.recordingId,
          canPlayOriginalAudio:
            true,
        })
    },
  )

  it(
    'does not load sources when view permission is denied',
    async () => {
      const provider =
        createProvider([])

      mocks.requireMemoryPermission
        .mockRejectedValue(
          new Error('access denied'),
        )

      await expect(
        searchMemoryArchive(
          userId,
          memoryId,
          {},
          {
            sourceProviders: [
              provider,
            ],
          },
        ),
      ).rejects.toThrow(
        'access denied',
      )

      expect(provider.listApprovedSources)
        .not.toHaveBeenCalled()
    },
  )

  it(
    'rejects an invalid filter before checking access',
    async () => {
      await expect(
        searchMemoryArchive(
          userId,
          memoryId,
          {
            sourceType: 'draft',
          },
          {
            sourceProviders: [
              createProvider([]),
            ],
          },
        ),
      ).rejects.toMatchObject({
        name: 'ZodError',
      })

      expect(
        mocks.requireMemoryPermission,
      ).not.toHaveBeenCalled()
    },
  )
})
