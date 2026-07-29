import MemoryRecording from '../media/MemoryRecording.js'
import MemoryRecordingTranscript from '../media/MemoryRecordingTranscript.js'
import {
  APPROVED_SOURCE_CONTENT_MAX_LENGTH,
  createApprovedSource,
} from './approvedSource.js'

export const APPROVED_RECORDING_TRANSCRIPT_CANDIDATE_LIMIT =
  40

export const RECORDING_TRANSCRIPT_SOURCE_CHUNK_CHARACTERS =
  Math.min(
    5000,
    APPROVED_SOURCE_CONTENT_MAX_LENGTH,
  )

export const RECORDING_TRANSCRIPT_SOURCE_CHUNK_LIMIT =
  6

const SOURCE_TITLE_MAX_LENGTH = 200

function resolveCandidateLimit(limit) {
  if (!Number.isInteger(limit)) {
    return APPROVED_RECORDING_TRANSCRIPT_CANDIDATE_LIMIT
  }

  return Math.min(
    Math.max(limit, 1),
    APPROVED_RECORDING_TRANSCRIPT_CANDIDATE_LIMIT,
  )
}

function splitTranscriptContent(
  content,
) {
  const chunks = []

  for (
    let offset = 0;
    offset < content.length &&
    chunks.length <
      RECORDING_TRANSCRIPT_SOURCE_CHUNK_LIMIT;
    offset +=
      RECORDING_TRANSCRIPT_SOURCE_CHUNK_CHARACTERS
  ) {
    const chunk = content
      .slice(
        offset,
        offset +
          RECORDING_TRANSCRIPT_SOURCE_CHUNK_CHARACTERS,
      )
      .trim()

    if (chunk.length > 0) {
      chunks.push(chunk)
    }
  }

  return chunks
}

function createSourceTitle(
  recording,
  chunkIndex,
  chunkCount,
) {
  const recordingName =
    typeof recording.displayName ===
      'string' &&
    recording.displayName.trim()
      .length > 0
      ? recording.displayName.trim()
      : 'הקלטה'

  const chunkSuffix =
    chunkCount > 1
      ? ` — חלק ${chunkIndex + 1}`
      : ''

  return `תמלול מאושר: ${recordingName}${chunkSuffix}`
    .slice(
      0,
      SOURCE_TITLE_MAX_LENGTH,
    )
    .trim()
}

function createTranscriptSources(
  transcript,
  recording,
) {
  const chunks =
    splitTranscriptContent(
      transcript.content,
    )

  return chunks.map(
    (content, chunkIndex) =>
      createApprovedSource({
        sourceType:
          'recording_transcript',
        sourceId:
          transcript._id.toString(),
        title:
          createSourceTitle(
            recording,
            chunkIndex,
            chunks.length,
          ),
        content,
        approvedAt:
          transcript.approvedAt,
        sourceVersion:
          `revision:${transcript.revision}:chunk:${chunkIndex + 1}`,
      }),
  )
}

function getRecordingIds(
  transcripts,
) {
  return Array.from(
    new Set(
      transcripts
        .map((transcript) =>
          transcript.recordingId
            ?.toString(),
        )
        .filter(Boolean),
    ),
  )
}

export async function listApprovedRecordingTranscriptSources(
  memoryId,
  {
    limit =
      APPROVED_RECORDING_TRANSCRIPT_CANDIDATE_LIMIT,
  } = {},
) {
  const candidateLimit =
    resolveCandidateLimit(limit)

  const transcripts =
    await MemoryRecordingTranscript
      .find({
        memoryId,
        reviewStatus: 'approved',
        lifecycleStatus: 'active',
      })
      .sort({
        updatedAt: -1,
      })
      .limit(candidateLimit)
      .select({
        _id: 1,
        recordingId: 1,
        content: 1,
        approvedAt: 1,
        revision: 1,
        updatedAt: 1,
      })
      .lean()

  if (transcripts.length === 0) {
    return []
  }

  const recordingIds =
    getRecordingIds(
      transcripts,
    )

  if (recordingIds.length === 0) {
    return []
  }

  const recordings =
    await MemoryRecording
      .find({
        _id: {
          $in: recordingIds,
        },
        memoryId,
        lifecycleStatus: 'active',
        storageStatus: 'stored',
        transcriptionStatus:
          'completed',
        'consent.permittedUses':
          'memory_grounding',
      })
      .select({
        _id: 1,
        displayName: 1,
      })
      .lean()

  const recordingsById =
    new Map(
      recordings.map(
        (recording) => [
          recording._id.toString(),
          recording,
        ],
      ),
    )

  const sources = []

  for (const transcript of transcripts) {
    const recording =
      recordingsById.get(
        transcript.recordingId
          .toString(),
      )

    if (!recording) {
      continue
    }

    const transcriptSources =
      createTranscriptSources(
        transcript,
        recording,
      )

    for (
      const source of
        transcriptSources
    ) {
      if (
        sources.length >=
        candidateLimit
      ) {
        return sources
      }

      sources.push(source)
    }
  }

  return sources
}

export const approvedRecordingTranscriptSourceProvider =
  Object.freeze({
    sourceType:
      'recording_transcript',
    listApprovedSources:
      listApprovedRecordingTranscriptSources,
  })