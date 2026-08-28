import {
  listGuidedStories,
} from '../media/guidedStoryService.js'
import {
  MEMORY_PERMISSIONS,
  requireMemoryPermission,
} from './memoryAccessService.js'
import MemoryStory from './MemoryStory.js'
import {
  memoryProfileParamsSchema,
} from './validation.js'

export const MEMORY_TIMELINE_ENTRY_LIMIT =
  100

const TIMELINE_SUMMARY_MAX_LENGTH =
  300

function normalizeText(value) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim()
    : ''
}

function createSummary(value) {
  const content = normalizeText(value)

  if (
    content.length <=
    TIMELINE_SUMMARY_MAX_LENGTH
  ) {
    return content
  }

  return `${content
    .slice(
      0,
      TIMELINE_SUMMARY_MAX_LENGTH - 1,
    )
    .trim()}…`
}

export function createWrittenTimelineEntry(
  story,
  memoryId,
) {
  const occurredOn =
    typeof story.occurredOn ===
      'string' &&
    story.occurredOn.length > 0
      ? story.occurredOn
      : null

  return Object.freeze({
    id: `story:${story._id}`,
    sourceType: 'memory_story',
    sourceId: story._id.toString(),
    title: story.title,
    summary:
      createSummary(story.content),
    occurredOn,
    documentedAt:
      story.createdAt ?? null,
    sourceRoute:
      `/app/memories/${memoryId}#stories-title`,
    recordingId: null,
    canPlayOriginalAudio: false,
  })
}

export function createGuidedTimelineEntry(
  story,
  memoryId,
) {
  return Object.freeze({
    id: `recording:${story.recordingId}`,
    sourceType:
      'recording_transcript',
    sourceId: story.id,
    title: story.title,
    summary: story.summary,
    occurredOn: null,
    documentedAt:
      story.recordedAt ??
      story.approvedAt ??
      null,
    sourceRoute:
      `/app/memories/${memoryId}#recordings-title`,
    recordingId:
      story.recordingId,
    canPlayOriginalAudio:
      story.canPlayOriginalAudio,
  })
}

function compareDatedEntries(
  first,
  second,
) {
  return first.occurredOn.localeCompare(
    second.occurredOn,
  )
}

function compareUndatedEntries(
  first,
  second,
) {
  const firstDate = new Date(
    first.documentedAt ?? 0,
  ).getTime()

  const secondDate = new Date(
    second.documentedAt ?? 0,
  ).getTime()

  return secondDate - firstDate
}

export async function listMemoryTimeline(
  userId,
  memoryId,
) {
  const validatedMemoryId =
    memoryProfileParamsSchema.parse({
      memoryId,
    }).memoryId

  await requireMemoryPermission(
    userId,
    validatedMemoryId,
    MEMORY_PERMISSIONS.VIEW,
  )

  const [writtenStories, guidedStories] =
    await Promise.all([
      MemoryStory.find({
        memoryId: validatedMemoryId,
        status: 'approved',
      })
        .sort({
          occurredOn: 1,
          createdAt: 1,
        })
        .limit(
          MEMORY_TIMELINE_ENTRY_LIMIT,
        )
        .select({
          _id: 1,
          title: 1,
          content: 1,
          occurredOn: 1,
          createdAt: 1,
        })
        .lean(),
      listGuidedStories(
        userId,
        validatedMemoryId,
      ),
    ])

  const entries = [
    ...writtenStories.map((story) =>
      createWrittenTimelineEntry(
        story,
        validatedMemoryId,
      ),
    ),
    ...guidedStories.map((story) =>
      createGuidedTimelineEntry(
        story,
        validatedMemoryId,
      ),
    ),
  ]

  const datedEntries = entries
    .filter((entry) => entry.occurredOn)
    .sort(compareDatedEntries)

  const undatedEntries = entries
    .filter((entry) => !entry.occurredOn)
    .sort(compareUndatedEntries)

  return {
    datedEntries,
    undatedEntries,
    totalCount: entries.length,
  }
}
