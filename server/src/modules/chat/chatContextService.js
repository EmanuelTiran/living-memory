import {
    approvedBiographySourceProvider,
  } from './approvedBiographySourceProvider.js'
  import {
    approvedRecordingTranscriptSourceProvider,
  } from './approvedRecordingTranscriptSourceProvider.js'
  import {
    approvedStorySourceProvider,
  } from './approvedStorySourceProvider.js'
  import {
    createApprovedSource,
  } from './approvedSource.js'
  import {
    chatMemoryParamsSchema,
    sendChatMessageSchema,
  } from './validation.js'

  export const MAX_CHAT_CONTEXT_SOURCES = 6

  export const MAX_CHAT_CONTEXT_CHARACTERS =
    12000

  export const CHAT_SOURCE_CANDIDATE_LIMIT =
    40

  export const INSUFFICIENT_CONTEXT_RESPONSE =
    'אין בזיכרונות המאושרים מספיק מידע כדי לענות על השאלה הזאת.'

  const defaultSourceProviders =
    Object.freeze([
      approvedStorySourceProvider,
      approvedBiographySourceProvider,
      approvedRecordingTranscriptSourceProvider,
    ])

  const stopWords = new Set([
    'את',
    'אני',
    'אבל',
    'או',
    'איך',
    'אם',
    'אין',
    'אל',
    'גם',
    'האם',
    'הוא',
    'היא',
    'היה',
    'הייתה',
    'היו',
    'זה',
    'זאת',
    'מה',
    'מי',
    'על',
    'עם',
    'של',
    'שלו',
    'שלה',
    'the',
    'a',
    'an',
    'and',
    'about',
    'is',
    'of',
    'to',
    'was',
    'were',
  ])

  function tokenize(value) {
    const matches = value
      .normalize('NFKC')
      .toLocaleLowerCase('he-IL')
      .match(/[\p{L}\p{N}]+/gu)

    return (matches ?? []).filter(
      (token) =>
        token.length > 1 &&
        !stopWords.has(token),
    )
  }

  function calculateSourceScore(
    source,
    queryTokens,
  ) {
    const titleTokens = new Set(
      tokenize(source.title),
    )

    const contentTokens = new Set(
      tokenize(source.content),
    )

    return queryTokens.reduce(
      (score, token) => {
        let tokenScore = 0

        if (titleTokens.has(token)) {
          tokenScore += 4
        }

        if (contentTokens.has(token)) {
          tokenScore += 1
        }

        return score + tokenScore
      },
      0,
    )
  }

  function rankSources(
    sources,
    message,
  ) {
    const queryTokens = Array.from(
      new Set(
        tokenize(message),
      ),
    )

    if (queryTokens.length === 0) {
      return []
    }

    return sources
      .map(
        (source, index) => ({
          source,
          index,
          score:
            calculateSourceScore(
              source,
              queryTokens,
            ),
        }),
      )
      .filter(
        ({ score }) =>
          score > 0,
      )
      .sort(
        (first, second) =>
          second.score -
            first.score ||
          first.index -
            second.index,
      )
      .map(
        ({ source }) => source,
      )
  }

  function selectBoundedSources(
    sources,
  ) {
    const selectedSources = []
    let usedCharacters = 0

    for (const source of sources) {
      if (
        selectedSources.length >=
        MAX_CHAT_CONTEXT_SOURCES
      ) {
        break
      }

      const remainingCharacters =
        MAX_CHAT_CONTEXT_CHARACTERS -
        usedCharacters

      const titleCharacters =
        source.title.length

      if (
        remainingCharacters <=
        titleCharacters
      ) {
        break
      }

      const availableContentCharacters =
        remainingCharacters -
        titleCharacters

      const boundedContent =
        source.content
          .slice(
            0,
            availableContentCharacters,
          )
          .trim()

      if (
        boundedContent.length === 0
      ) {
        continue
      }

      selectedSources.push(
        Object.freeze({
          ...source,
          content:
            boundedContent,
        }),
      )

      usedCharacters +=
        titleCharacters +
        boundedContent.length
    }

    return selectedSources
  }

  function validateSourceProviders(
    sourceProviders,
  ) {
    if (
      !Array.isArray(
        sourceProviders,
      )
    ) {
      throw new TypeError(
        'Source providers must be an array.',
      )
    }

    for (
      const provider of
        sourceProviders
    ) {
      if (
        typeof provider
          ?.listApprovedSources !==
        'function'
      ) {
        throw new TypeError(
          'Each source provider must expose listApprovedSources().',
        )
      }
    }
  }

  async function loadApprovedSources(
    memoryId,
    sourceProviders,
  ) {
    validateSourceProviders(
      sourceProviders,
    )

    const sourceGroups =
      await Promise.all(
        sourceProviders.map(
          (provider) =>
            provider
              .listApprovedSources(
                memoryId,
                {
                  limit:
                    CHAT_SOURCE_CANDIDATE_LIMIT,
                },
              ),
        ),
      )

    return sourceGroups
      .flat()
      .map(
        (source) =>
          createApprovedSource(
            source,
          ),
      )
  }

  export async function buildChatContext(
    input,
    {
      sourceProviders =
        defaultSourceProviders,
    } = {},
  ) {
    const { memoryId } =
      chatMemoryParamsSchema.parse({
        memoryId:
          input?.memoryId,
      })

    const { message } =
      sendChatMessageSchema.parse({
        message:
          input?.message,
      })

    const approvedSources =
      await loadApprovedSources(
        memoryId,
        sourceProviders,
      )

    const rankedSources =
      rankSources(
        approvedSources,
        message,
      )

    const selectedSources =
      selectBoundedSources(
        rankedSources,
      )

    if (
      selectedSources.length === 0
    ) {
      return {
        groundingStatus:
          'insufficient_context',
        message,
        sources: [],
        fallbackResponse:
          INSUFFICIENT_CONTEXT_RESPONSE,
      }
    }

    return {
      groundingStatus: 'grounded',
      message,
      sources:
        selectedSources,
      fallbackResponse: null,
    }
  }
