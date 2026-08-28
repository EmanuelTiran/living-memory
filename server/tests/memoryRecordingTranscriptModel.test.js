import {
    describe,
    expect,
    it,
  } from 'vitest'
  import MemoryRecordingTranscript from '../src/modules/media/MemoryRecordingTranscript.js'

  const memoryId =
    '507f1f77bcf86cd799439010'

  const recordingId =
    '507f1f77bcf86cd799439011'

  const userId =
    '507f1f77bcf86cd799439012'

  const secondUserId =
    '507f1f77bcf86cd799439013'

  const recordingChecksumSha256 =
    'a'.repeat(64)

  function createTranscript(overrides = {}) {
    return new MemoryRecordingTranscript({
      memoryId,
      recordingId,
      requestedByUserId: userId,
      content:
        'This is a generated recording transcript.',
      languageCode: 'he',
      transcriptionProvider: 'openai',
      transcriptionModel:
        'gpt-4o-mini-transcribe',
      providerResponseId:
        'transcription-response-id',
      recordingChecksumSha256,
      generatedAt:
        new Date(
          '2026-07-28T10:00:00.000Z',
        ),
      ...overrides,
    })
  }

  describe(
    'MemoryRecordingTranscript model',
    () => {
      it('creates a safe draft transcript', async () => {
        const transcript =
          createTranscript()

        await transcript.validate()

        const publicTranscript =
          transcript.toJSON()

        expect(
          publicTranscript,
        ).toMatchObject({
          id:
            transcript._id.toString(),
          content:
            'This is a generated recording transcript.',
          languageCode: 'he',
          transcriptionProvider:
            'openai',
          transcriptionModel:
            'gpt-4o-mini-transcribe',
          reviewStatus: 'draft',
          revision: 1,
          lifecycleStatus: 'active',
          approvedAt: null,
          approvedByUserId: null,
          sourceIndexStatus:
            'not_indexed',
          sourceIndexedAt: null,
          sourceIndexRevision: null,
          archivedAt: null,
          archivedByUserId: null,
        })

        expect(
          publicTranscript,
        ).not.toHaveProperty(
          'providerResponseId',
        )

        expect(
          publicTranscript,
        ).not.toHaveProperty(
          'recordingChecksumSha256',
        )
      })

      it('accepts an approved transcript with approval metadata', async () => {
        const approvedAt =
          new Date(
            '2026-07-28T11:00:00.000Z',
          )

        const transcript =
          createTranscript({
            reviewStatus: 'approved',
            approvedAt,
            approvedByUserId:
              secondUserId,
          })

        await expect(
          transcript.validate(),
        ).resolves.toBeUndefined()
      })

      it('accepts only the current approved revision in the source index', async () => {
        const approvedAt =
          new Date(
            '2026-07-28T11:00:00.000Z',
          )
        const transcript =
          createTranscript({
            reviewStatus: 'approved',
            approvedAt,
            approvedByUserId:
              secondUserId,
            sourceIndexStatus:
              'indexed',
            sourceIndexedAt:
              approvedAt,
            sourceIndexRevision: 1,
          })

        await expect(
          transcript.validate(),
        ).resolves.toBeUndefined()

        transcript.sourceIndexRevision = 2

        await expect(
          transcript.validate(),
        ).rejects.toThrow(
          'Indexed transcript sources must match the current approved revision.',
        )
      })

      it('rejects an approved transcript without approval metadata', async () => {
        const transcript =
          createTranscript({
            reviewStatus: 'approved',
          })

        const validationError =
          await transcript
            .validate()
            .catch((error) => error)

        expect(
          validationError.errors,
        ).toHaveProperty(
          'approvedAt',
        )

        expect(
          validationError.errors,
        ).toHaveProperty(
          'approvedByUserId',
        )
      })

      it('rejects approval metadata on a draft transcript', async () => {
        const transcript =
          createTranscript({
            approvedAt:
              new Date(
                '2026-07-28T11:00:00.000Z',
              ),
            approvedByUserId:
              secondUserId,
          })

        const validationError =
          await transcript
            .validate()
            .catch((error) => error)

        expect(
          validationError.errors,
        ).toHaveProperty(
          'approvedAt',
        )

        expect(
          validationError.errors,
        ).toHaveProperty(
          'approvedByUserId',
        )
      })

      it('accepts an archived transcript with archive metadata', async () => {
        const transcript =
          createTranscript({
            lifecycleStatus: 'archived',
            archivedAt:
              new Date(
                '2026-07-28T12:00:00.000Z',
              ),
            archivedByUserId:
              secondUserId,
          })

        await expect(
          transcript.validate(),
        ).resolves.toBeUndefined()
      })

      it('rejects an archived transcript without archive metadata', async () => {
        const transcript =
          createTranscript({
            lifecycleStatus: 'archived',
          })

        const validationError =
          await transcript
            .validate()
            .catch((error) => error)

        expect(
          validationError.errors,
        ).toHaveProperty(
          'archivedAt',
        )

        expect(
          validationError.errors,
        ).toHaveProperty(
          'archivedByUserId',
        )
      })

      it('rejects archive metadata on an active transcript', async () => {
        const transcript =
          createTranscript({
            archivedAt:
              new Date(
                '2026-07-28T12:00:00.000Z',
              ),
            archivedByUserId:
              secondUserId,
          })

        const validationError =
          await transcript
            .validate()
            .catch((error) => error)

        expect(
          validationError.errors,
        ).toHaveProperty(
          'archivedAt',
        )

        expect(
          validationError.errors,
        ).toHaveProperty(
          'archivedByUserId',
        )
      })

      it('rejects a non-integer revision', async () => {
        const transcript =
          createTranscript({
            revision: 1.5,
          })

        const validationError =
          await transcript
            .validate()
            .catch((error) => error)

        expect(
          validationError.errors,
        ).toHaveProperty(
          'revision',
        )
      })

      it('defines one transcript per recording', () => {
        const transcriptIndex =
          MemoryRecordingTranscript
            .schema
            .indexes()
            .find(
              ([, options]) =>
                options.name ===
                'memory_recording_transcripts_unique_recording',
            )

        expect(
          transcriptIndex?.[0],
        ).toEqual({
          recordingId: 1,
        })

        expect(
          transcriptIndex?.[1],
        ).toMatchObject({
          unique: true,
        })
      })
    },
  )
