import {
    describe,
    expect,
    it,
  } from 'vitest'
  import {
    RECORDING_TRANSCRIPT_MAX_LENGTH,
  } from '../src/modules/media/MemoryRecordingTranscript.js'
  import {
    approveMemoryRecordingTranscriptSchema,
    memoryRecordingTranscriptParamsSchema,
    memoryRecordingTranscriptionParamsSchema,
    requestMemoryRecordingTranscriptionSchema,
    updateMemoryRecordingTranscriptSchema,
  } from '../src/modules/media/transcriptionValidation.js'

  const memoryId =
    '507f1f77bcf86cd799439010'

  const recordingId =
    '507f1f77bcf86cd799439011'

  const transcriptId =
    '507f1f77bcf86cd799439012'

  describe(
    'Recording transcription validation',
    () => {
      it('accepts a transcription request without a language override', () => {
        expect(
          requestMemoryRecordingTranscriptionSchema
            .parse({}),
        ).toEqual({})
      })

      it('normalizes a valid transcription language override', () => {
        expect(
          requestMemoryRecordingTranscriptionSchema
            .parse({
              languageCode: '  he-IL  ',
            }),
        ).toEqual({
          languageCode: 'he-IL',
        })
      })

      it('rejects invalid transcription request fields', () => {
        expect(() =>
          requestMemoryRecordingTranscriptionSchema
            .parse({
              languageCode: 'he_il',
            }),
        ).toThrow()

        expect(() =>
          requestMemoryRecordingTranscriptionSchema
            .parse({
              unknownField: true,
            }),
        ).toThrow()
      })

      it('normalizes transcript updates with an expected revision', () => {
        expect(
          updateMemoryRecordingTranscriptSchema
            .parse({
              content:
                '  Corrected transcript content.  ',
              expectedRevision: 2,
            }),
        ).toEqual({
          content:
            'Corrected transcript content.',
          expectedRevision: 2,
        })
      })

      it('rejects invalid transcript updates', () => {
        expect(() =>
          updateMemoryRecordingTranscriptSchema
            .parse({
              content: '   ',
              expectedRevision: 1,
            }),
        ).toThrow()

        expect(() =>
          updateMemoryRecordingTranscriptSchema
            .parse({
              content:
                'Corrected content.',
              expectedRevision: 0,
            }),
        ).toThrow()

        expect(() =>
          updateMemoryRecordingTranscriptSchema
            .parse({
              content:
                'Corrected content.',
            }),
        ).toThrow()
      })

      it('rejects oversized transcript content', () => {
        expect(() =>
          updateMemoryRecordingTranscriptSchema
            .parse({
              content:
                'a'.repeat(
                  RECORDING_TRANSCRIPT_MAX_LENGTH +
                    1,
                ),
              expectedRevision: 1,
            }),
        ).toThrow()
      })

      it('accepts explicit transcript source approval', () => {
        expect(
          approveMemoryRecordingTranscriptSchema
            .parse({
              expectedRevision: 3,
              confirmSourceUse: true,
            }),
        ).toEqual({
          expectedRevision: 3,
          confirmSourceUse: true,
        })
      })

      it('rejects approval without explicit source confirmation', () => {
        expect(() =>
          approveMemoryRecordingTranscriptSchema
            .parse({
              expectedRevision: 1,
            }),
        ).toThrow()

        expect(() =>
          approveMemoryRecordingTranscriptSchema
            .parse({
              expectedRevision: 1,
              confirmSourceUse: false,
            }),
        ).toThrow()
      })

      it('accepts valid recording transcription identifiers', () => {
        expect(
          memoryRecordingTranscriptionParamsSchema
            .parse({
              memoryId,
              recordingId,
            }),
        ).toEqual({
          memoryId,
          recordingId,
        })
      })

      it('accepts valid transcript identifiers', () => {
        expect(
          memoryRecordingTranscriptParamsSchema
            .parse({
              memoryId,
              recordingId,
              transcriptId,
            }),
        ).toEqual({
          memoryId,
          recordingId,
          transcriptId,
        })
      })

      it('rejects invalid transcription identifiers', () => {
        expect(() =>
          memoryRecordingTranscriptionParamsSchema
            .parse({
              memoryId: 'invalid-memory',
              recordingId,
            }),
        ).toThrow()

        expect(() =>
          memoryRecordingTranscriptParamsSchema
            .parse({
              memoryId,
              recordingId,
              transcriptId:
                'invalid-transcript',
            }),
        ).toThrow()
      })
    },
  )
