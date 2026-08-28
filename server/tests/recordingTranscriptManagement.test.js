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
    findTranscript: vi.fn(),
    updateTranscript: vi.fn(),
  }))

  vi.mock(
    '../src/modules/memories/memoryAccessService.js',
    () => ({
      MEMORY_PERMISSIONS: {
        VIEW: 'view',
        EDIT: 'edit',
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
        findOneAndUpdate:
          mocks.updateTranscript,
      },
    }),
  )

  import {
    approveMemoryRecordingTranscript,
    getMemoryRecordingTranscript,
    updateMemoryRecordingTranscript,
  } from '../src/modules/media/recordingTranscriptManagementService.js'

  const userId =
    '507f1f77bcf86cd799439010'

  const memoryId =
    '507f1f77bcf86cd799439011'

  const recordingId =
    '507f1f77bcf86cd799439012'

  const transcriptId =
    '507f1f77bcf86cd799439013'

  function createPublicTranscript(
    overrides = {},
  ) {
    return {
      id: transcriptId,
      memoryId,
      recordingId,
      content:
        'Original transcript.',
      languageCode: 'he',
      reviewStatus: 'draft',
      revision: 1,
      lifecycleStatus: 'active',
      approvedAt: null,
      approvedByUserId: null,
      ...overrides,
    }
  }

  function createTranscriptDocument(
    overrides = {},
  ) {
    const publicTranscript =
      createPublicTranscript(
        overrides,
      )

    return {
      _id: transcriptId,
      ...publicTranscript,
      toJSON: vi.fn(
        () => publicTranscript,
      ),
    }
  }

  function createRecording(
    overrides = {},
  ) {
    return {
      _id: recordingId,
      memoryId,
      lifecycleStatus: 'active',
      consent: {
        permittedUses: [
          'transcription',
          'memory_grounding',
        ],
      },
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.resetAllMocks()

    mocks.requireMemoryPermission
      .mockResolvedValue({
        authorization: {
          permission: 'view',
        },
      })

    mocks.findRecording
      .mockResolvedValue(
        createRecording(),
      )

    mocks.findTranscript
      .mockResolvedValue(
        createTranscriptDocument(),
      )

    mocks.updateTranscript
      .mockResolvedValue(
        createTranscriptDocument({
          content:
            'Corrected transcript.',
          revision: 2,
        }),
      )
  })

  describe(
    'Recording transcript management',
    () => {
      it('returns a transcript to a user with view permission', async () => {
        const result =
          await getMemoryRecordingTranscript(
            userId,
            memoryId,
            recordingId,
          )

        expect(
          mocks.requireMemoryPermission,
        ).toHaveBeenCalledWith(
          userId,
          memoryId,
          'view',
        )

        expect(result).toEqual(
          createPublicTranscript(),
        )
      })

      it('updates a draft with optimistic revision protection', async () => {
        const result =
          await updateMemoryRecordingTranscript(
            userId,
            memoryId,
            recordingId,
            {
              content:
                '  Corrected transcript.  ',
              expectedRevision: 1,
            },
          )

        expect(
          mocks.requireMemoryPermission,
        ).toHaveBeenCalledWith(
          userId,
          memoryId,
          'edit',
        )

        expect(
          mocks.updateTranscript,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            _id: transcriptId,
            memoryId,
            recordingId,
            lifecycleStatus:
              'active',
            reviewStatus: 'draft',
            revision: 1,
          }),
          {
            $set: {
              content:
                'Corrected transcript.',
              sourceIndexStatus:
                'not_indexed',
              sourceIndexedAt: null,
              sourceIndexRevision: null,
            },
            $inc: {
              revision: 1,
            },
          },
          {
            returnDocument: 'after',
            runValidators: true,
          },
        )

        expect(result).toEqual(
          createPublicTranscript({
            content:
              'Corrected transcript.',
            revision: 2,
          }),
        )
      })

      it('does not allow an approved transcript to be edited', async () => {
        mocks.findTranscript
          .mockResolvedValue(
            createTranscriptDocument({
              reviewStatus:
                'approved',
              approvedAt:
                new Date(),
              approvedByUserId:
                userId,
            }),
          )

        await expect(
          updateMemoryRecordingTranscript(
            userId,
            memoryId,
            recordingId,
            {
              content:
                'Changed content.',
              expectedRevision: 1,
            },
          ),
        ).rejects.toMatchObject({
          statusCode: 409,
          code:
            'RECORDING_TRANSCRIPT_ALREADY_APPROVED',
        })

        expect(
          mocks.updateTranscript,
        ).not.toHaveBeenCalled()
      })

      it('rejects a stale transcript revision', async () => {
        mocks.findTranscript
          .mockResolvedValue(
            createTranscriptDocument({
              revision: 3,
            }),
          )

        await expect(
          updateMemoryRecordingTranscript(
            userId,
            memoryId,
            recordingId,
            {
              content:
                'Changed content.',
              expectedRevision: 2,
            },
          ),
        ).rejects.toMatchObject({
          statusCode: 409,
          code:
            'RECORDING_TRANSCRIPT_CONFLICT',
        })

        expect(
          mocks.updateTranscript,
        ).not.toHaveBeenCalled()
      })

      it('approves a transcript for grounding with explicit consent', async () => {
        const approvedAt =
          new Date(
            '2026-07-28T21:00:00.000Z',
          )

        mocks.updateTranscript
          .mockResolvedValue(
            createTranscriptDocument({
              reviewStatus:
                'approved',
              approvedAt,
              approvedByUserId:
                userId,
              sourceIndexStatus:
                'indexed',
              sourceIndexedAt:
                approvedAt,
              sourceIndexRevision: 1,
            }),
          )

        const result =
          await approveMemoryRecordingTranscript(
            userId,
            memoryId,
            recordingId,
            {
              expectedRevision: 1,
              confirmSourceUse: true,
            },
          )

        expect(
          mocks.requireMemoryPermission,
        ).toHaveBeenCalledWith(
          userId,
          memoryId,
          'edit',
        )

        expect(
          mocks.updateTranscript,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            _id: transcriptId,
            memoryId,
            recordingId,
            reviewStatus: 'draft',
            revision: 1,
          }),
          {
            $set: {
              reviewStatus:
                'approved',
              approvedAt:
                expect.any(Date),
              approvedByUserId:
                userId,
              sourceIndexStatus:
                'indexed',
              sourceIndexedAt:
                expect.any(Date),
              sourceIndexRevision: 1,
            },
          },
          {
            returnDocument: 'after',
            runValidators: true,
          },
        )

        expect(result).toEqual({
          transcript:
            createPublicTranscript({
              reviewStatus:
                'approved',
              approvedAt,
              approvedByUserId:
                userId,
              sourceIndexStatus:
                'indexed',
              sourceIndexedAt:
                approvedAt,
              sourceIndexRevision: 1,
            }),
          approved: true,
        })
      })

      it('rejects source approval without memory-grounding consent', async () => {
        mocks.findRecording
          .mockResolvedValue(
            createRecording({
              consent: {
                permittedUses: [
                  'transcription',
                ],
              },
            }),
          )

        await expect(
          approveMemoryRecordingTranscript(
            userId,
            memoryId,
            recordingId,
            {
              expectedRevision: 1,
              confirmSourceUse: true,
            },
          ),
        ).rejects.toMatchObject({
          statusCode: 409,
          code:
            'TRANSCRIPT_GROUNDING_NOT_CONSENTED',
        })

        expect(
          mocks.findTranscript,
        ).not.toHaveBeenCalled()

        expect(
          mocks.updateTranscript,
        ).not.toHaveBeenCalled()
      })

      it('treats repeated approval as idempotent', async () => {
        const approvedTranscript =
          createTranscriptDocument({
            reviewStatus:
              'approved',
            approvedAt:
              new Date(
                '2026-07-28T21:00:00.000Z',
              ),
            approvedByUserId:
              userId,
            sourceIndexStatus:
              'indexed',
            sourceIndexedAt:
              new Date(
                '2026-07-28T21:00:00.000Z',
              ),
            sourceIndexRevision: 1,
          })

        mocks.findTranscript
          .mockResolvedValue(
            approvedTranscript,
          )

        const result =
          await approveMemoryRecordingTranscript(
            userId,
            memoryId,
            recordingId,
            {
              expectedRevision: 1,
              confirmSourceUse: true,
            },
          )

        expect(result).toEqual({
          transcript:
            approvedTranscript.toJSON(),
          approved: false,
        })

        expect(
          mocks.updateTranscript,
        ).not.toHaveBeenCalled()
      })

      it('stops before transcript access when permission is denied', async () => {
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
          getMemoryRecordingTranscript(
            userId,
            memoryId,
            recordingId,
          ),
        ).rejects.toMatchObject({
          code: 'MEMORY_NOT_FOUND',
        })

        expect(
          mocks.findTranscript,
        ).not.toHaveBeenCalled()
      })

      it('returns a safe error when the transcript does not exist', async () => {
        mocks.findTranscript
          .mockResolvedValue(null)

        await expect(
          getMemoryRecordingTranscript(
            userId,
            memoryId,
            recordingId,
          ),
        ).rejects.toMatchObject({
          statusCode: 404,
          code:
            'RECORDING_TRANSCRIPT_NOT_FOUND',
        })
      })

      it('validates management input before authorization', async () => {
        await expect(
          updateMemoryRecordingTranscript(
            userId,
            memoryId,
            recordingId,
            {
              content: ' ',
              expectedRevision: 1,
            },
          ),
        ).rejects.toThrow()

        await expect(
          approveMemoryRecordingTranscript(
            userId,
            memoryId,
            recordingId,
            {
              expectedRevision: 1,
              confirmSourceUse:
                false,
            },
          ),
        ).rejects.toThrow()

        expect(
          mocks.requireMemoryPermission,
        ).not.toHaveBeenCalled()
      })
    },
  )
