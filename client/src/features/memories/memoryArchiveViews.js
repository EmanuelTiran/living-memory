export const MEMORY_ARCHIVE_VIEW_IDS = {
  stories: 'stories',
  storyMap: 'story-map',
  timeline: 'timeline',
  recordings: 'recordings',
  assets: 'assets',
}

export const MEMORY_ARCHIVE_VIEWS = [
  {
    id: MEMORY_ARCHIVE_VIEW_IDS.stories,
    label: 'סיפורים',
    hash: '#saved-stories-title',
    tooltip: 'כל הסיפורים שנשמרו בארכיון',
  },
  {
    id: MEMORY_ARCHIVE_VIEW_IDS.storyMap,
    label: 'מפת סיפורים',
    hash: '#guided-story-map',
    tooltip: 'לראות סיפורים לפי נושאים וקשרים',
  },
  {
    id: MEMORY_ARCHIVE_VIEW_IDS.timeline,
    label: 'ציר זמן',
    hash: '#memory-timeline-title',
    tooltip: 'לראות את הזיכרונות לאורך השנים',
  },
  {
    id: MEMORY_ARCHIVE_VIEW_IDS.recordings,
    label: 'הקלטות',
    hash: '#recordings-title',
    tooltip: 'לשמוע ולנהל הקלטות מקור',
  },
  {
    id: MEMORY_ARCHIVE_VIEW_IDS.assets,
    label: 'תמונות וקבצים',
    hash: '#memory-assets-title',
    tooltip: 'לראות תמונות וקבצים שנשמרו',
  },
]

const VIEW_IDS = new Set(
  MEMORY_ARCHIVE_VIEWS.map(
    (view) => view.id,
  ),
)

const RECORDING_TARGET_TYPES = new Set([
  'recording',
  'continue-interview',
])

export function resolveMemoryArchiveView({
  requestedView,
  hash = '',
  targetType = '',
}) {
  if (
    RECORDING_TARGET_TYPES.has(
      targetType,
    ) ||
    hash.startsWith('#memory-recording-')
  ) {
    return MEMORY_ARCHIVE_VIEW_IDS.recordings
  }

  if (
    targetType === 'review-draft-story' ||
    hash.startsWith('#memory-story-')
  ) {
    return MEMORY_ARCHIVE_VIEW_IDS.stories
  }

  const hashView =
    MEMORY_ARCHIVE_VIEWS.find(
      (view) => view.hash === hash,
    )?.id

  if (hashView) {
    return hashView
  }

  if (VIEW_IDS.has(requestedView)) {
    return requestedView
  }

  return MEMORY_ARCHIVE_VIEW_IDS.stories
}

export function createMemoryArchiveViewSearch(
  currentSearch,
  viewId,
) {
  const searchParams =
    new URLSearchParams(currentSearch)

  searchParams.set('tab', 'archive')
  searchParams.set(
    'archiveView',
    VIEW_IDS.has(viewId)
      ? viewId
      : MEMORY_ARCHIVE_VIEW_IDS.stories,
  )

  return `?${searchParams.toString()}`
}

export function getMemoryArchiveViewHash(
  viewId,
) {
  return MEMORY_ARCHIVE_VIEWS.find(
    (view) => view.id === viewId,
  )?.hash ?? ''
}
