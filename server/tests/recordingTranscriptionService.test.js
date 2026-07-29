import {
    createHash,
  } from 'node:crypto'
  import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
  } from 'vitest'
  import { AppError } from '../src/errors/AppError.js'

  const mocks = vi.hoisted(() => ({
    requireMemoryPermission: vi.fn(),
    findRecording: vi.fn(),
    updateRecording: vi.fn(),
    findTranscript: vi.fn(),
    createTranscript: vi.fn(),
    readBuffer: vi.fn(),
    transcribeRecording: vi.fn(),
  }))

  vi.mock(
    '../src/modules/memories/memoryAccessService.js',
    () => ({
      MEMORY_PERMISSIONS: {
        CONTRIBUTE: 'contribute',
      },
      requireMemoryPermission:
        mocks.requireMemoryPermission,
    }),
  )

  vi.mock(
    '../src/modules/media/MemoryRecording.js',
    () => ({
      default: {
        findOne:
          mocks.findRecording,
        findOneAndUpdate:
          mocks.updateRecording,
      },
    }),
  )

  vi.mock(
    '../src/modules/media/MemoryRecordingTranscript.js',
    () => ({
      RECORDING_TRANSCRIPT_MAX_LENGTH:
        500_000,
      default: {
        findOne:
          mocks.findTranscript,
        create:
          mocks.createTranscript,
      },
    }),
  )

  vi.mock(
    '../src/modules/media/privateRecordingStorage.js',
    () => ({
      privateRecordingStorage: {
        provider: 'local_private',
        readBuffer:
          mocks.readBuffer,
      },
    }),
  )

  vi.mock(
    '../src/modules/media/openaiTranscriptionProvider.js',
    () => ({
      transcribeRecordingWithOpenAI:
        mocks.transcribeRecording,
    }),
  )

  import {
    transcribeMemoryRecording,
  } from '../src/modules/media/recordingTranscriptionService.js'

  const userId =
    '507f1f77bcf86cd799439010'

  const memoryId =
    '507f1f77bcf86cd799439011'

  const recordingId =
    '507f1f77bcf86cd799439012'

  const transcriptId =
    '507f1f77bcf86cd799439013'

  const sourceAudio =
    Buffer.from([
      0x1a,
      0x45,
      0xdf,
      0xa3,
    ])

  function createChecksum(buffer) {
    return createHash('sha256')
      .update(buffer)
      .digest('hex')
  }

  function createRecording(
    overrides = {},
  ) {
    return {
      _id: recordingId,
      memoryId,
      uploadedByUserId: userId,
      originalFileName:
        'recording.webm',
      mimeType: 'audio/webm',
      sizeBytes:
        sourceAudio.length,
      languageCode: 'he',
      consent: {
        permittedUses: [
          'transcription',
        ],
      },
      storageStatus: 'stored',
      storageProvider:
        'local_private',
      storageKey:
        `${memoryId}/${recordingId}/audio.webm`,
      checksumSha256:
        createChecksum(sourceAudio),
      transcriptionStatus:
        'not_requested',
      lifecycleStatus: 'active',
      ...overrides,
    }
  }

  const publicTranscript = {
    id: transcriptId,
    memoryId,
    recordingId,
    content:
      'This is the transcript.',
    languageCode: 'he',
    transcriptionProvider:
      'openai',
    transcriptionModel:
      'gpt-transcribe',
    reviewStatus: 'draft',
    revision: 1,
    lifecycleStatus: 'active',
  }

  function createTranscriptDocument(
    overrides = {},
  ) {
    const values = {
      _id: transcriptId,
      memoryId,
      recordingId,
      requestedByUserId: userId,
      content:
        'This is the transcript.',
      languageCode: 'he',
      transcriptionProvider:
        'openai',
      transcriptionModel:
        'gpt-transcribe',
      generatedAt:
        new Date(
          '2026-07-28T20:00:00.000Z',
        ),
      reviewStatus: 'draft',
      lifecycleStatus: 'active',
      ...overrides,
    }

    return {
      ...values,
      toJSON: vi.fn(() => ({
        ...publicTranscript,
        ...overrides,
      })),
    }
  }

  function createSelectableResult(value) {
    return {
      select:
        vi.fn().mockResolvedValue(
          value,
        ),
    }
  }

  beforeEach(() => {
    vi.resetAllMocks()

    const recording =
      createRecording()

    mocks.requireMemoryPermission
      .mockResolvedValue({
        authorization: {
          permission: 'contribute',
        },
      })

    mocks.findRecording
      .mockReturnValue(
        createSelectableResult(
          recording,
        ),
      )

    mocks.findTranscript
      .mockResolvedValue(null)

    mocks.updateRecording
      .mockResolvedValueOnce({
        ...recording,
        transcriptionStatus:
          'processing',
      })
      .mockResolvedValueOnce({
        ...recording,
        transcriptionStatus:
          'completed',
      })

    mocks.readBuffer
      .mockResolvedValue(
        Buffer.from(sourceAudio),
      )

    mocks.transcribeRecording
      .mockResolvedValue({
        content:
          'This is the transcript.',
        languageCode: 'he',
        provider: 'openai',
        model: 'gpt-transcribe',
        providerResponseId:
          'provider-response-id',
      })

    mocks.createTranscript
      .mockResolvedValue(
        createTranscriptDocument(),
      )
  })

  describe(
    'Recording transcription service',
    () => {
      it('transcribes a stored recording and saves a draft', async () => {
        const audioBuffer =
          Buffer.from(sourceAudio)

        mocks.readBuffer
          .mockResolvedValue(
            audioBuffer,
          )

        const result =
          await transcribeMemoryRecording(
            userId,
            memoryId,
            recordingId,
            {},
          )

        expect(
          mocks.requireMemoryPermission,
        ).toHaveBeenCalledWith(
          userId,
          memoryId,
          'contribute',
        )

        expect(
          mocks.transcribeRecording,
        ).toHaveBeenCalledWith({
          audioBuffer,
          originalFileName:
            'recording.webm',
          mimeType: 'audio/webm',
          languageCode: 'he',
        })

        expect(
          mocks.createTranscript,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            memoryId,
            recordingId,
            requestedByUserId:
              userId,
            content:
              'This is the transcript.',
            languageCode: 'he',
            transcriptionProvider:
              'openai',
            transcriptionModel:
              'gpt-transcribe',
            providerResponseId:
              'provider-response-id',
            recordingChecksumSha256:
              createChecksum(
                sourceAudio,
              ),
            reviewStatus: 'draft',
            revision: 1,
            lifecycleStatus: 'active',
            generatedAt:
              expect.any(Date),
          }),
        )

        expect(result).toEqual({
          transcript:
            publicTranscript,
          created: true,
        })

        expect(
          Array.from(audioBuffer),
        ).toEqual([
          0,
          0,
          0,
          0,
        ])
      })

      it('uses a validated language override', async () => {
        await transcribeMemoryRecording(
          userId,
          memoryId,
          recordingId,
          {
            languageCode:
              '  en-US  ',
          },
        )

        expect(
          mocks.transcribeRecording,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            languageCode: 'en-US',
          }),
        )
      })

      it('returns an existing transcript without calling OpenAI again', async () => {
        const recording =
          createRecording({
            transcriptionStatus:
              'completed',
          })

        const transcript =
          createTranscriptDocument()

        mocks.findRecording
          .mockReturnValue(
            createSelectableResult(
              recording,
            ),
          )

        mocks.findTranscript
          .mockResolvedValue(
            transcript,
          )

        const result =
          await transcribeMemoryRecording(
            userId,
            memoryId,
            recordingId,
          )

        expect(result).toEqual({
          transcript:
            publicTranscript,
          created: false,
        })

        expect(
          mocks.readBuffer,
        ).not.toHaveBeenCalled()

        expect(
          mocks.transcribeRecording,
        ).not.toHaveBeenCalled()

        expect(
          mocks.createTranscript,
        ).not.toHaveBeenCalled()
      })

      it('stops before database access when permission is denied', async () => {
        mocks.requireMemoryPermission
          .mockRejectedValue(
            new AppError(
              'Memory profile was not found.',
              {
                statusCode: 404,
                code:
                  'MEMORY_NOT_FOUND',
              },
            ),
          )

        await expect(
          transcribeMemoryRecording(
            userId,
            memoryId,
            recordingId,
          ),
        ).rejects.toMatchObject({
          code: 'MEMORY_NOT_FOUND',
        })

        expect(
          mocks.findRecording,
        ).not.toHaveBeenCalled()
      })

      it('returns a safe error when the recording does not exist', async () => {
        mocks.findRecording
          .mockReturnValue(
            createSelectableResult(
              null,
            ),
          )

        await expect(
          transcribeMemoryRecording(
            userId,
            memoryId,
            recordingId,
          ),
        ).rejects.toMatchObject({
          statusCode: 404,
          code: 'RECORDING_NOT_FOUND',
        })

        expect(
          mocks.transcribeRecording,
        ).not.toHaveBeenCalled()
      })

      it('requires explicit transcription consent', async () => {
        mocks.findRecording
          .mockReturnValue(
            createSelectableResult(
              createRecording({
                consent: {
                  permittedUses: [
                    'recording_playback',
                  ],
                },
              }),
            ),
          )

        await expect(
          transcribeMemoryRecording(
            userId,
            memoryId,
            recordingId,
          ),
        ).rejects.toMatchObject({
          statusCode: 409,
          code:
            'RECORDING_TRANSCRIPTION_NOT_CONSENTED',
        })

        expect(
          mocks.findTranscript,
        ).not.toHaveBeenCalled()

        expect(
          mocks.transcribeRecording,
        ).not.toHaveBeenCalled()
      })

      it('requires a stored private recording file', async () => {
        mocks.findRecording
          .mockReturnValue(
            createSelectableResult(
              createRecording({
                storageStatus:
                  'pending',
                storageProvider: '',
                storageKey: '',
              }),
            ),
          )

        await expect(
          transcribeMemoryRecording(
            userId,
            memoryId,
            recordingId,
          ),
        ).rejects.toMatchObject({
          statusCode: 409,
          code:
            'RECORDING_FILE_UNAVAILABLE',
        })

        expect(
          mocks.readBuffer,
        ).not.toHaveBeenCalled()
      })

      it('prevents concurrent transcription requests', async () => {
        mocks.findRecording
          .mockReturnValue(
            createSelectableResult(
              createRecording({
                transcriptionStatus:
                  'processing',
              }),
            ),
          )

        await expect(
          transcribeMemoryRecording(
            userId,
            memoryId,
            recordingId,
          ),
        ).rejects.toMatchObject({
          statusCode: 409,
          code:
            'RECORDING_TRANSCRIPTION_IN_PROGRESS',
        })

        expect(
          mocks.readBuffer,
        ).not.toHaveBeenCalled()
      })

      it('rejects corrupted recording content and clears the buffer', async () => {
        const corruptedBuffer =
          Buffer.from([
            0x00,
            0x01,
            0x02,
            0x03,
          ])

        mocks.readBuffer
          .mockResolvedValue(
            corruptedBuffer,
          )

        await expect(
          transcribeMemoryRecording(
            userId,
            memoryId,
            recordingId,
          ),
        ).rejects.toMatchObject({
          statusCode: 409,
          code:
            'RECORDING_INTEGRITY_FAILED',
        })

        expect(
          mocks.transcribeRecording,
        ).not.toHaveBeenCalled()

        expect(
          Array.from(
            corruptedBuffer,
          ),
        ).toEqual([
          0,
          0,
          0,
          0,
        ])

        expect(
          mocks.updateRecording,
        ).toHaveBeenCalledTimes(2)
      })

      it('records a safe failure and clears audio when OpenAI fails', async () => {
        const audioBuffer =
          Buffer.from(sourceAudio)

        mocks.readBuffer
          .mockResolvedValue(
            audioBuffer,
          )

        mocks.transcribeRecording
          .mockRejectedValue(
            new AppError(
              'The transcription service is temporarily unavailable.',
              {
                statusCode: 503,
                code:
                  'TRANSCRIPTION_PROVIDER_UNAVAILABLE',
              },
            ),
          )

        await expect(
          transcribeMemoryRecording(
            userId,
            memoryId,
            recordingId,
          ),
        ).rejects.toMatchObject({
          statusCode: 503,
          code:
            'TRANSCRIPTION_PROVIDER_UNAVAILABLE',
        })

        expect(
          Array.from(audioBuffer),
        ).toEqual([
          0,
          0,
          0,
          0,
        ])

        expect(
          mocks.createTranscript,
        ).not.toHaveBeenCalled()

        expect(
          mocks.updateRecording,
        ).toHaveBeenCalledTimes(2)
      })

      it('validates the request before authorization and database access', async () => {
        await expect(
          transcribeMemoryRecording(
            userId,
            memoryId,
            recordingId,
            {
              languageCode:
                'invalid_language',
            },
          ),
        ).rejects.toThrow()

        expect(
          mocks.requireMemoryPermission,
        ).not.toHaveBeenCalled()

        expect(
          mocks.findRecording,
        ).not.toHaveBeenCalled()
      })
    },
  )
