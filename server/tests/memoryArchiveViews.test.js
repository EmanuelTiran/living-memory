import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  createMemoryArchiveViewSearch,
  getMemoryArchiveViewHash,
  MEMORY_ARCHIVE_VIEW_IDS,
  resolveMemoryArchiveView,
} from '../../client/src/features/memories/memoryArchiveViews.js'

describe('memory archive views', () => {
  it.each([
    ['stories', 'stories'],
    ['story-map', 'story-map'],
    ['timeline', 'timeline'],
    ['recordings', 'recordings'],
    ['assets', 'assets'],
  ])(
    'restores the %s view from the URL',
    (requestedView, expectedView) => {
      expect(
        resolveMemoryArchiveView({
          requestedView,
        }),
      ).toBe(expectedView)
    },
  )

  it('uses stories for an absent or unknown view', () => {
    expect(
      resolveMemoryArchiveView({
        requestedView: 'unknown',
      }),
    ).toBe(
      MEMORY_ARCHIVE_VIEW_IDS.stories,
    )
  })

  it.each([
    ['#memory-story-story-1', 'stories'],
    ['#guided-story-map', 'story-map'],
    ['#memory-timeline-title', 'timeline'],
    ['#recordings-title', 'recordings'],
    ['#memory-recording-recording-1', 'recordings'],
    ['#memory-assets-title', 'assets'],
  ])(
    'opens the matching view for the legacy hash %s',
    (hash, expectedView) => {
      expect(
        resolveMemoryArchiveView({
          requestedView: 'stories',
          hash,
        }),
      ).toBe(expectedView)
    },
  )

  it.each([
    'recording',
    'continue-interview',
  ])(
    'opens recordings for a %s Today target',
    (targetType) => {
      expect(
        resolveMemoryArchiveView({
          requestedView: 'stories',
          targetType,
        }),
      ).toBe(
        MEMORY_ARCHIVE_VIEW_IDS.recordings,
      )
    },
  )

  it('preserves other query parameters when changing a view', () => {
    expect(
      createMemoryArchiveViewSearch(
        '?source=pilot&tab=today',
        MEMORY_ARCHIVE_VIEW_IDS.timeline,
      ),
    ).toBe(
      '?source=pilot&tab=archive&archiveView=timeline',
    )
  })

  it('provides a stable focus hash for each view', () => {
    expect(
      getMemoryArchiveViewHash(
        MEMORY_ARCHIVE_VIEW_IDS.assets,
      ),
    ).toBe('#memory-assets-title')
  })
})
