import MemoryBiographyAnswer from '../memories/MemoryBiographyAnswer.js'
import { createApprovedSource } from './approvedSource.js'

export const APPROVED_BIOGRAPHY_CANDIDATE_LIMIT =
  40

const SOURCE_TITLE_MAX_LENGTH = 200

function resolveCandidateLimit(limit) {
  if (!Number.isInteger(limit)) {
    return APPROVED_BIOGRAPHY_CANDIDATE_LIMIT
  }

  return Math.min(
    Math.max(limit, 1),
    APPROVED_BIOGRAPHY_CANDIDATE_LIMIT,
  )
}

function createBiographySource(
  biographyAnswer,
) {
  const title =
    biographyAnswer.question
      .slice(
        0,
        SOURCE_TITLE_MAX_LENGTH,
      )
      .trim()

  return createApprovedSource({
    sourceType: 'biography_answer',
    sourceId:
      biographyAnswer._id.toString(),
    title,
    content:
      biographyAnswer.answer,
    approvedAt:
      biographyAnswer.approvedAt,
    sourceVersion:
      `revision:${biographyAnswer.revision}`,
  })
}

export async function listApprovedBiographySources(
  memoryId,
  {
    limit =
      APPROVED_BIOGRAPHY_CANDIDATE_LIMIT,
  } = {},
) {
  const candidateLimit =
    resolveCandidateLimit(limit)

  const biographyAnswers =
    await MemoryBiographyAnswer.find({
      memoryId,
      status: 'approved',
    })
      .sort({
        updatedAt: -1,
      })
      .limit(candidateLimit)
      .select({
        _id: 1,
        question: 1,
        answer: 1,
        approvedAt: 1,
        revision: 1,
        updatedAt: 1,
      })
      .lean()

  return biographyAnswers.map(
    createBiographySource,
  )
}

export const approvedBiographySourceProvider =
  Object.freeze({
    sourceType: 'biography_answer',
    listApprovedSources:
      listApprovedBiographySources,
  })