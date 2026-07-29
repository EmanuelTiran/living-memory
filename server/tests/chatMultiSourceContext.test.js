import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
  } from 'vitest'

  const mocks = vi.hoisted(() => ({
    listApprovedStorySources:
      vi.fn(),
    listApprovedBiographySources:
      vi.fn(),
    listApprovedRecordingTranscriptSources:
      vi.fn(),
  }))

  vi.mock(
    '../src/modules/chat/approvedStorySourceProvider.js',
    () => ({
      approvedStorySourceProvider: {
        sourceType: 'memory_story',
        listApprovedSources:
          mocks.listApprovedStorySources,
      },
    }),
  )

  vi.mock(
    '../src/modules/chat/approvedBiographySourceProvider.js',
    () => ({
      approvedBiographySourceProvider: {
        sourceType:
          'biography_answer',
        listApprovedSources:
          mocks.listApprovedBiographySources,
      },
    }),
  )

  vi.mock(
    '../src/modules/chat/approvedRecordingTranscriptSourceProvider.js',
    () => ({
      approvedRecordingTranscriptSourceProvider: {
        sourceType:
          'recording_transcript',
        listApprovedSources:
          mocks
            .listApprovedRecordingTranscriptSources,
      },
    }),
  )

  import {
    CHAT_SOURCE_CANDIDATE_LIMIT,
    buildChatContext,
  } from '../src/modules/chat/chatContextService.js'

  const memoryId =
    '507f1f77bcf86cd799439010'

  const approvedAt =
    new Date(
      '2026-07-28T11:00:00.000Z',
    )

  const storySource = {
    sourceType: 'memory_story',
    sourceId:
      '507f1f77bcf86cd799439011',
    title: 'Her work',
    content:
      'שרה עבדה כמורה במשך שנים רבות.',
    approvedAt: null,
    sourceVersion:
      '2026-07-28T10:00:00.000Z',
  }

  const biographySource = {
    sourceType: 'biography_answer',
    sourceId:
      '507f1f77bcf86cd799439012',
    title: 'מקום הלידה של שרה',
    content:
      'שרה נולדה בירושלים.',
    approvedAt,
    sourceVersion: 'revision:1',
  }

  const transcriptSource = {
    sourceType:
      'recording_transcript',
    sourceId:
      '507f1f77bcf86cd799439013',
    title:
      'תמלול מאושר: סיפור החיים',
    content:
      'שרה סיפרה בהקלטה על עבודתה ועל ילדותה בירושלים.',
    approvedAt,
    sourceVersion:
      'revision:2:chunk:1',
  }

  beforeEach(() => {
    vi.resetAllMocks()

    mocks.listApprovedStorySources
      .mockResolvedValue([
        storySource,
      ])

    mocks.listApprovedBiographySources
      .mockResolvedValue([
        biographySource,
      ])

    mocks
      .listApprovedRecordingTranscriptSources
      .mockResolvedValue([
        transcriptSource,
      ])
  })

  describe(
    'Chat context with multiple source types',
    () => {
      it('loads every approved source type through the default providers', async () => {
        const result =
          await buildChatContext({
            memoryId,
            message:
              'איפה שרה נולדה ומה היא סיפרה על עבודתה?',
          })

        expect(
          mocks.listApprovedStorySources,
        ).toHaveBeenCalledWith(
          memoryId,
          {
            limit:
              CHAT_SOURCE_CANDIDATE_LIMIT,
          },
        )

        expect(
          mocks.listApprovedBiographySources,
        ).toHaveBeenCalledWith(
          memoryId,
          {
            limit:
              CHAT_SOURCE_CANDIDATE_LIMIT,
          },
        )

        expect(
          mocks
            .listApprovedRecordingTranscriptSources,
        ).toHaveBeenCalledWith(
          memoryId,
          {
            limit:
              CHAT_SOURCE_CANDIDATE_LIMIT,
          },
        )

        expect(
          result.groundingStatus,
        ).toBe('grounded')

        expect(
          result.sources.map(
            (source) =>
              source.sourceType,
          ),
        ).toEqual(
          expect.arrayContaining([
            'memory_story',
            'biography_answer',
            'recording_transcript',
          ]),
        )
      })

      it('returns insufficient context when no provider has a relevant source', async () => {
        mocks.listApprovedStorySources
          .mockResolvedValue([])

        mocks.listApprovedBiographySources
          .mockResolvedValue([])

        mocks
          .listApprovedRecordingTranscriptSources
          .mockResolvedValue([])

        const result =
          await buildChatContext({
            memoryId,
            message:
              'What was the favorite color?',
          })

        expect(result).toMatchObject({
          groundingStatus:
            'insufficient_context',
          sources: [],
          fallbackResponse:
            expect.any(String),
        })
      })
    },
  )
