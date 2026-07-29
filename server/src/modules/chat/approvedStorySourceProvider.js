import MemoryStory from '../memories/MemoryStory.js'
import { createApprovedSource } from './approvedSource.js'

export const APPROVED_STORY_CANDIDATE_LIMIT =
  40

function resolveCandidateLimit(limit) {
  if (!Number.isInteger(limit)) {
    return APPROVED_STORY_CANDIDATE_LIMIT
  }

  return Math.min(
    Math.max(limit, 1),
    APPROVED_STORY_CANDIDATE_LIMIT,
  )
}

function createStorySource(story) {
  const sourceVersion =
    story.updatedAt instanceof Date
      ? story.updatedAt.toISOString()
      : String(story.updatedAt ?? '')

  return createApprovedSource({
    sourceType: 'memory_story',
    sourceId: story._id.toString(),
    title: story.title,
    content: story.content,
    approvedAt: null,
    sourceVersion,
  })
}

export async function listApprovedStorySources(
  memoryId,
  {
    limit =
      APPROVED_STORY_CANDIDATE_LIMIT,
  } = {},
) {
  const candidateLimit =
    resolveCandidateLimit(limit)

  const stories = await MemoryStory.find({
    memoryId,
    status: 'approved',
  })
    .sort({
      updatedAt: -1,
    })
    .limit(candidateLimit)
    .select({
      _id: 1,
      title: 1,
      content: 1,
      updatedAt: 1,
    })
    .lean()

  return stories.map(createStorySource)
}

export const approvedStorySourceProvider =
  Object.freeze({
    sourceType: 'memory_story',
    listApprovedSources:
      listApprovedStorySources,
  })