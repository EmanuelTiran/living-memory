import {
  approvedBiographySourceProvider,
} from '../chat/approvedBiographySourceProvider.js'
import {
  approvedProfileSourceProvider,
} from '../chat/approvedProfileSourceProvider.js'
import {
  approvedRecordingTranscriptSourceProvider,
} from '../chat/approvedRecordingTranscriptSourceProvider.js'
import {
  approvedStorySourceProvider,
} from '../chat/approvedStorySourceProvider.js'
import {
  createApprovedSource,
} from '../chat/approvedSource.js'
import {
  MEMORY_PERMISSIONS,
  requireMemoryPermission,
} from './memoryAccessService.js'
import {
  archiveSearchQuerySchema,
} from './archiveSearchValidation.js'
import {
  memoryProfileParamsSchema,
} from './validation.js'

export const ARCHIVE_SEARCH_CANDIDATE_LIMIT =
  50

const ARCHIVE_SEARCH_EXCERPT_LENGTH =
  280

const defaultSourceProviders =
  Object.freeze([
    approvedProfileSourceProvider,
    approvedBiographySourceProvider,
    approvedStorySourceProvider,
    approvedRecordingTranscriptSourceProvider,
  ])

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('he-IL')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value) {
  return normalizeSearchText(value)
    .match(/[\p{L}\p{N}]+/gu) ?? []
}

function calculateSearchScore(
  source,
  normalizedQuery,
  queryTokens,
) {
  if (!normalizedQuery) {
    return 1
  }

  const normalizedTitle =
    normalizeSearchText(source.title)
  const normalizedContent =
    normalizeSearchText(source.content)

  let score = 0

  if (
    normalizedTitle.includes(
      normalizedQuery,
    )
  ) {
    score += 12
  }

  if (
    normalizedContent.includes(
      normalizedQuery,
    )
  ) {
    score += 6
  }

  for (const token of queryTokens) {
    if (normalizedTitle.includes(token)) {
      score += 4
    }

    if (normalizedContent.includes(token)) {
      score += 1
    }
  }

  return score
}

function parseSourceVersionDate(
  sourceVersion,
) {
  if (
    typeof sourceVersion !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T/.test(
      sourceVersion,
    )
  ) {
    return null
  }

  const date = new Date(sourceVersion)

  return Number.isNaN(date.getTime())
    ? null
    : date
}

function resolveSourceDate(source) {
  return source.recordedAt ??
    source.approvedAt ??
    parseSourceVersionDate(
      source.sourceVersion,
    )
}

function createExcerpt(content) {
  const normalizedContent =
    String(content ?? '')
      .replace(/\s+/g, ' ')
      .trim()

  if (
    normalizedContent.length <=
    ARCHIVE_SEARCH_EXCERPT_LENGTH
  ) {
    return normalizedContent
  }

  return `${normalizedContent
    .slice(
      0,
      ARCHIVE_SEARCH_EXCERPT_LENGTH - 1,
    )
    .trim()}…`
}

function createSearchResult(
  source,
  score,
) {
  return {
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    title: source.title,
    excerpt:
      createExcerpt(source.content),
    sourceDate:
      resolveSourceDate(source),
    sourceRoute:
      source.sourceRoute ?? null,
    recordingId:
      source.recordingId ?? null,
    canPlayOriginalAudio:
      source.canPlayOriginalAudio ===
      true,
    score,
  }
}

function matchesFilters(
  result,
  {
    sourceType,
    audioFilter,
  },
) {
  if (
    sourceType !== 'all' &&
    result.sourceType !== sourceType
  ) {
    return false
  }

  if (
    audioFilter === 'playable' &&
    !result.canPlayOriginalAudio
  ) {
    return false
  }

  return true
}

function compareResults(first, second) {
  const scoreDifference =
    second.score - first.score

  if (scoreDifference !== 0) {
    return scoreDifference
  }

  const firstDate = new Date(
    first.sourceDate ?? 0,
  ).getTime()

  const secondDate = new Date(
    second.sourceDate ?? 0,
  ).getTime()

  return secondDate - firstDate
}

function validateSourceProviders(
  sourceProviders,
) {
  if (!Array.isArray(sourceProviders)) {
    throw new TypeError(
      'Archive source providers must be an array.',
    )
  }

  for (const provider of sourceProviders) {
    if (
      typeof provider
        ?.listApprovedSources !==
      'function'
    ) {
      throw new TypeError(
        'Each archive source provider must expose listApprovedSources().',
      )
    }
  }
}

export async function searchMemoryArchive(
  userId,
  memoryId,
  query = {},
  {
    sourceProviders =
      defaultSourceProviders,
  } = {},
) {
  const validatedMemoryId =
    memoryProfileParamsSchema.parse({
      memoryId,
    }).memoryId

  const validatedQuery =
    archiveSearchQuerySchema.parse(query)

  validateSourceProviders(
    sourceProviders,
  )

  await requireMemoryPermission(
    userId,
    validatedMemoryId,
    MEMORY_PERMISSIONS.VIEW,
  )

  const sourceGroups =
    await Promise.all(
      sourceProviders.map((provider) =>
        provider.listApprovedSources(
          validatedMemoryId,
          {
            limit:
              ARCHIVE_SEARCH_CANDIDATE_LIMIT,
          },
        ),
      ),
    )

  const normalizedQuery =
    normalizeSearchText(
      validatedQuery.q,
    )
  const queryTokens =
    tokenize(validatedQuery.q)

  const matchingResults = sourceGroups
    .flat()
    .map((source) =>
      createApprovedSource(source),
    )
    .map((source) => ({
      source,
      score:
        calculateSearchScore(
          source,
          normalizedQuery,
          queryTokens,
        ),
    }))
    .filter(({ score }) => score > 0)
    .map(({ source, score }) =>
      createSearchResult(
        source,
        score,
      ),
    )
    .filter((result) =>
      matchesFilters(
        result,
        validatedQuery,
      ),
    )
    .sort(compareResults)

  return {
    query: validatedQuery.q,
    filters: {
      sourceType:
        validatedQuery.sourceType,
      audioFilter:
        validatedQuery.audioFilter,
    },
    results: matchingResults
      .slice(
        0,
        validatedQuery.limit,
      )
      .map(
        ({ score: _score, ...result }) =>
          result,
      ),
    total: matchingResults.length,
    limit: validatedQuery.limit,
  }
}
