import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
  } from 'vitest'
  import { AppError } from '../src/errors/AppError.js'

  const mocks = vi.hoisted(() => ({
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    sort: vi.fn(),
    requireMemoryPermission: vi.fn(),
  }))

  vi.mock(
    '../src/modules/media/MemoryRecording.js',
    async (importOriginal) => {
      const actual =
        await importOriginal()

      return {
        ...actual,
        default: {
          create: mocks.create,
          find: mocks.find,
          findOne: mocks.findOne,
        },
      }
    },
  )

  vi.mock(
    '../src/modules/memories/memoryAccessService.js',
    () => ({
      MEMORY_PERMISSIONS: {
        VIEW: 'view',
        CHAT: 'chat',
        CONTRIBUTE: 'contribute',
        EDIT: 'edit',
        MANAGE: 'manage',
      },
      requireMemoryPermission:
        mocks.requireMemoryPermission,
    }),
  )

  import {
    createMemoryRecordingMetadata,
    getMemoryRecording,
    listMemoryRecordings,
  } from '../src/modules/media/recordingService.js'

  const userId =
    '507f1f77bcf86cd799439010'

  const memoryId =
    '507f1f77bcf86cd799439011'

  const recordingId =
    '507f1f77bcf86cd799439012'

  const currentTime =
    new Date(
      '2026-07-28T14:00:00.000Z',
    )

  const recordingInput = {
    displayName:
      '  Interview with Sarah  ',
    originalFileName:
      '  sarah-interview.webm  ',
    mimeType: 'audio/webm',
    sizeBytes: 2048,
    consent: {
      confirmed: true,
      basis: 'subject_consent',
      permittedUses: [
        'transcription',
        'memory_grounding',
      ],
    },
  }

  const publicRecording = {
    id: recordingId,
    memoryId,
    uploadedByUserId: userId,
    displayName:
      'Interview with Sarah',
    originalFileName:
      'sarah-interview.webm',
    mimeType: 'audio/webm',
    sizeBytes: 2048,
    languageCode: 'he',
    storageStatus: 'pending',
    transcriptionStatus:
      'not_requested',
    lifecycleStatus: 'active',
    consent: {
      basis: 'subject_consent',
      permittedUses: [
        'transcription',
        'memory_grounding',
      ],
      confirmedAt:
        currentTime.toISOString(),
      statementVersion:
        'recording-consent-v1',
    },
  }

  function createRecordingDocument(
    value = publicRecording,
  ) {
    return {
      toJSON: vi.fn(() => value),
    }
  }

  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(currentTime)

    mocks.requireMemoryPermission
      .mockResolvedValue({
        authorization: {
          role: 'owner',
        },
      })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Recording service', () => {
    it('creates normalized recording metadata for an authorized contributor', async () => {
      const recordingDocument =
        createRecordingDocument()

      mocks.create.mockResolvedValue(
        recordingDocument,
      )

      const result =
        await createMemoryRecordingMetadata(
          userId,
          memoryId,
          recordingInput,
        )

      expect(
        mocks.requireMemoryPermission,
      ).toHaveBeenCalledWith(
        userId,
        memoryId,
        'contribute',
      )

      expect(
        mocks.create,
      ).toHaveBeenCalledWith({
        memoryId,
        uploadedByUserId: userId,
        displayName:
          'Interview with Sarah',
        originalFileName:
          'sarah-interview.webm',
        mimeType: 'audio/webm',
        sizeBytes: 2048,
        languageCode: 'he',
        consent: {
          basis: 'subject_consent',
          permittedUses: [
            'transcription',
            'memory_grounding',
          ],
          confirmedByUserId:
            userId,
          confirmedAt: currentTime,
          statementVersion:
            'recording-consent-v1',
        },
      })

      expect(result).toEqual(
        publicRecording,
      )
    })

    it('does not create metadata when contribution access is denied', async () => {
      mocks.requireMemoryPermission
        .mockRejectedValue(
          new AppError(
            'Memory profile was not found.',
            {
              statusCode: 404,
              code: 'MEMORY_NOT_FOUND',
            },
          ),
        )

      await expect(
        createMemoryRecordingMetadata(
          userId,
          memoryId,
          recordingInput,
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'MEMORY_NOT_FOUND',
      })

      expect(
        mocks.create,
      ).not.toHaveBeenCalled()
    })

    it('lists active recordings for an authorized viewer', async () => {
      const recordingDocument =
        createRecordingDocument()

      mocks.find.mockReturnValue({
        sort: mocks.sort,
      })

      mocks.sort.mockResolvedValue([
        recordingDocument,
      ])

      const result =
        await listMemoryRecordings(
          userId,
          memoryId,
        )

      expect(
        mocks.requireMemoryPermission,
      ).toHaveBeenCalledWith(
        userId,
        memoryId,
        'view',
      )

      expect(
        mocks.find,
      ).toHaveBeenCalledWith({
        memoryId,
        lifecycleStatus: 'active',
      })

      expect(
        mocks.sort,
      ).toHaveBeenCalledWith({
        createdAt: -1,
        _id: -1,
      })

      expect(result).toEqual([
        publicRecording,
      ])
    })

    it('returns an active recording for an authorized viewer', async () => {
      const recordingDocument =
        createRecordingDocument()

      mocks.findOne.mockResolvedValue(
        recordingDocument,
      )

      const result =
        await getMemoryRecording(
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

      expect(
        mocks.findOne,
      ).toHaveBeenCalledWith({
        _id: recordingId,
        memoryId,
        lifecycleStatus: 'active',
      })

      expect(result).toEqual(
        publicRecording,
      )
    })

    it('returns a safe error when a recording is unavailable', async () => {
      mocks.findOne.mockResolvedValue(null)

      await expect(
        getMemoryRecording(
          userId,
          memoryId,
          recordingId,
        ),
      ).rejects.toMatchObject({
        name: 'AppError',
        statusCode: 404,
        code: 'RECORDING_NOT_FOUND',
        message:
          'Recording was not found.',
      })
    })

    it('rejects invalid identifiers before authorization and database access', async () => {
      await expect(
        listMemoryRecordings(
          userId,
          'invalid-memory-id',
        ),
      ).rejects.toThrow()

      await expect(
        getMemoryRecording(
          userId,
          memoryId,
          'invalid-recording-id',
        ),
      ).rejects.toThrow()

      expect(
        mocks.requireMemoryPermission,
      ).not.toHaveBeenCalled()

      expect(
        mocks.find,
      ).not.toHaveBeenCalled()

      expect(
        mocks.findOne,
      ).not.toHaveBeenCalled()
    })

    it('rejects invalid metadata before authorization and creation', async () => {
      await expect(
        createMemoryRecordingMetadata(
          userId,
          memoryId,
          {
            ...recordingInput,
            sizeBytes: 0,
          },
        ),
      ).rejects.toThrow()

      expect(
        mocks.requireMemoryPermission,
      ).not.toHaveBeenCalled()

      expect(
        mocks.create,
      ).not.toHaveBeenCalled()
    })

    it('rejects client-controlled storage fields', async () => {
      await expect(
        createMemoryRecordingMetadata(
          userId,
          memoryId,
          {
            ...recordingInput,
            storageStatus: 'stored',
            storageProvider: 'local',
            storageKey:
              'user-controlled-key',
          },
        ),
      ).rejects.toThrow()

      expect(
        mocks.requireMemoryPermission,
      ).not.toHaveBeenCalled()

      expect(
        mocks.create,
      ).not.toHaveBeenCalled()
    })
  })
