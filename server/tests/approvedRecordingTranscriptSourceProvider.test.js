import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
  } from 'vitest'

  const mocks = vi.hoisted(() => ({
    findTranscripts: vi.fn(),
    sortTranscripts: vi.fn(),
    limitTranscripts: vi.fn(),
    selectTranscripts: vi.fn(),
    leanTranscripts: vi.fn(),
    findRecordings: vi.fn(),
    selectRecordings: vi.fn(),
    leanRecordings: vi.fn(),
  }))

  vi.mock(
    '../src/modules/media/MemoryRecordingTranscript.js',
    () => ({
      default: {
        find:
          mocks.findTranscripts,
      },
    }),
  )

  vi.mock(
    '../src/modules/media/MemoryRecording.js',
    () => ({
      default: {
        find:
          mocks.findRecordings,
      },
    }),
  )

  import {
    APPROVED_RECORDING_TRANSCRIPT_CANDIDATE_LIMIT,
    RECORDING_TRANSCRIPT_SOURCE_CHUNK_CHARACTERS,
    listApprovedRecordingTranscriptSources,
  } from '../src/modules/chat/approvedRecordingTranscriptSourceProvider.js'

  const memoryId =
    '507f1f77bcf86cd799439010'

  const recordingId =
    '507f1f77bcf86cd799439011'

  const transcriptId =
    '507f1f77bcf86cd799439012'

  const approvedAt =
    new Date(
      '2026-07-28T20:00:00.000Z',
    )

  const recordedAt =
    new Date(
      '2026-07-28T19:00:00.000Z',
    )

  function createTranscript(
    overrides = {},
  ) {
    return {
      _id: transcriptId,
      recordingId,
      content:
        'שרה סיפרה שהיא עבדה כמורה.',
      approvedAt,
      revision: 2,
      ...overrides,
    }
  }

  function createRecording(
    overrides = {},
  ) {
    return {
      _id: recordingId,
      displayName:
        'הקלטת סיפור החיים',
      createdAt: recordedAt,
      consent: {
        permittedUses: [
          'memory_grounding',
          'recording_playback',
        ],
      },
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.resetAllMocks()

    mocks.findTranscripts
      .mockReturnValue({
        sort:
          mocks.sortTranscripts,
      })

    mocks.sortTranscripts
      .mockReturnValue({
        limit:
          mocks.limitTranscripts,
      })

    mocks.limitTranscripts
      .mockReturnValue({
        select:
          mocks.selectTranscripts,
      })

    mocks.selectTranscripts
      .mockReturnValue({
        lean:
          mocks.leanTranscripts,
      })

    mocks.leanTranscripts
      .mockResolvedValue([
        createTranscript(),
      ])

    mocks.findRecordings
      .mockReturnValue({
        select:
          mocks.selectRecordings,
      })

    mocks.selectRecordings
      .mockReturnValue({
        lean:
          mocks.leanRecordings,
      })

    mocks.leanRecordings
      .mockResolvedValue([
        createRecording(),
      ])
  })

  describe(
    'Approved recording transcript source provider',
    () => {
      it('returns approved transcript sources only for eligible recordings', async () => {
        const result =
          await listApprovedRecordingTranscriptSources(
            memoryId,
          )

        expect(
          mocks.findTranscripts,
        ).toHaveBeenCalledWith({
          memoryId,
          reviewStatus: 'approved',
          lifecycleStatus: 'active',
          $or: [
            {
              sourceIndexStatus:
                'indexed',
            },
            {
              sourceIndexStatus: {
                $exists: false,
              },
            },
          ],
        })

        expect(
          mocks.findRecordings,
        ).toHaveBeenCalledWith({
          _id: {
            $in: [recordingId],
          },
          memoryId,
          lifecycleStatus: 'active',
          storageStatus: 'stored',
          transcriptionStatus:
            'completed',
          'consent.permittedUses':
            'memory_grounding',
        })

        expect(
          mocks.selectRecordings,
        ).toHaveBeenCalledWith({
          _id: 1,
          displayName: 1,
          createdAt: 1,
          'consent.permittedUses': 1,
        })

        expect(result).toEqual([
          {
            sourceType:
              'recording_transcript',
            sourceId:
              transcriptId,
            title:
              'תמלול מאושר: הקלטת סיפור החיים',
            content:
              'שרה סיפרה שהיא עבדה כמורה.',
            approvedAt,
            sourceVersion:
              'revision:2:chunk:1',
            sourceRoute:
              `/app/memories/${memoryId}#recordings-title`,
            recordingId,
            recordedAt,
            canPlayOriginalAudio:
              true,
          },
        ])
      })

      it('does not offer original audio without playback consent', async () => {
        mocks.leanRecordings
          .mockResolvedValue([
            createRecording({
              consent: {
                permittedUses: [
                  'memory_grounding',
                ],
              },
            }),
          ])

        const result =
          await listApprovedRecordingTranscriptSources(
            memoryId,
          )

        expect(result[0])
          .toMatchObject({
            recordingId,
            recordedAt,
            canPlayOriginalAudio:
              false,
          })
      })

      it('excludes transcripts whose recordings are not authorized for grounding', async () => {
        mocks.leanRecordings
          .mockResolvedValue([])

        const result =
          await listApprovedRecordingTranscriptSources(
            memoryId,
          )

        expect(result).toEqual([])
      })

      it('does not query recordings when there are no approved transcripts', async () => {
        mocks.leanTranscripts
          .mockResolvedValue([])

        const result =
          await listApprovedRecordingTranscriptSources(
            memoryId,
          )

        expect(result).toEqual([])

        expect(
          mocks.findRecordings,
        ).not.toHaveBeenCalled()
      })

      it('splits long transcripts into bounded source chunks', async () => {
        const longContent =
          'א'.repeat(
            RECORDING_TRANSCRIPT_SOURCE_CHUNK_CHARACTERS *
              2 +
              200,
          )

        mocks.leanTranscripts
          .mockResolvedValue([
            createTranscript({
              content:
                longContent,
              revision: 4,
            }),
          ])

        const result =
          await listApprovedRecordingTranscriptSources(
            memoryId,
          )

        expect(result).toHaveLength(3)

        expect(
          result.every(
            (source) =>
              source.content.length <=
              RECORDING_TRANSCRIPT_SOURCE_CHUNK_CHARACTERS,
          ),
        ).toBe(true)

        expect(
          result.map(
            (source) =>
              source.sourceVersion,
          ),
        ).toEqual([
          'revision:4:chunk:1',
          'revision:4:chunk:2',
          'revision:4:chunk:3',
        ])

        expect(
          result.map(
            (source) =>
              source.title,
          ),
        ).toEqual([
          'תמלול מאושר: הקלטת סיפור החיים — חלק 1',
          'תמלול מאושר: הקלטת סיפור החיים — חלק 2',
          'תמלול מאושר: הקלטת סיפור החיים — חלק 3',
        ])
      })

      it('clamps the requested candidate limit', async () => {
        await listApprovedRecordingTranscriptSources(
          memoryId,
          {
            limit: 999,
          },
        )

        expect(
          mocks.limitTranscripts,
        ).toHaveBeenCalledWith(
          APPROVED_RECORDING_TRANSCRIPT_CANDIDATE_LIMIT,
        )
      })
    },
  )
