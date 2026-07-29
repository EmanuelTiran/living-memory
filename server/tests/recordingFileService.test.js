import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
  } from 'vitest'
  import { AppError } from '../src/errors/AppError.js'

  const mocks = vi.hoisted(() => ({
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    requireMemoryPermission: vi.fn(),
    saveBuffer: vi.fn(),
    deleteFile: vi.fn(),
  }))

  vi.mock(
    '../src/modules/media/MemoryRecording.js',
    async (importOriginal) => {
      const actual =
        await importOriginal()

      return {
        ...actual,
        default: {
          findOne: mocks.findOne,
          findOneAndUpdate:
            mocks.findOneAndUpdate,
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

  vi.mock(
    '../src/modules/media/privateRecordingStorage.js',
    () => ({
      privateRecordingStorage: {
        saveBuffer:
          mocks.saveBuffer,
        deleteFile:
          mocks.deleteFile,
      },
    }),
  )

  import { storeMemoryRecordingFile } from '../src/modules/media/recordingFileService.js'

  const userId =
    '507f1f77bcf86cd799439010'

  const memoryId =
    '507f1f77bcf86cd799439011'

  const recordingId =
    '507f1f77bcf86cd799439012'

  const storageMetadata = {
    storageProvider: 'local_private',
    storageKey:
      `${memoryId}/${recordingId}/file.webm`,
    sizeBytes: 8,
    checksumSha256: 'a'.repeat(64),
  }

  const publicRecording = {
    id: recordingId,
    memoryId,
    uploadedByUserId: userId,
    displayName:
      'Interview with Sarah',
    mimeType: 'audio/webm',
    sizeBytes: 8,
    storageStatus: 'stored',
  }

  function createFile(
    overrides = {},
  ) {
    const buffer = Buffer.from([
      0x1a,
      0x45,
      0xdf,
      0xa3,
      0x42,
      0x86,
      0x81,
      0x01,
    ])

    return {
      fieldname: 'recording',
      originalname:
        'interview.webm',
      mimetype: 'audio/webm',
      size: buffer.length,
      buffer,
      ...overrides,
    }
  }

  function createRecording(
    overrides = {},
  ) {
    return {
      _id: {
        toString: () =>
          recordingId,
      },
      memoryId,
      uploadedByUserId: userId,
      mimeType: 'audio/webm',
      sizeBytes: 8,
      storageStatus: 'pending',
      lifecycleStatus: 'active',
      ...overrides,
    }
  }

  function createStoredDocument() {
    return {
      toJSON: vi.fn(
        () => publicRecording,
      ),
    }
  }

  beforeEach(() => {
    vi.resetAllMocks()

    mocks.requireMemoryPermission
      .mockResolvedValue({
        authorization: {
          role: 'owner',
        },
      })

    mocks.saveBuffer
      .mockResolvedValue(
        storageMetadata,
      )

    mocks.deleteFile
      .mockResolvedValue(true)
  })

  describe('Recording file service', () => {
    it('stores a matching file and atomically updates its metadata', async () => {
      const recording =
        createRecording()

      const file = createFile()
      const originalBuffer =
        Buffer.from(file.buffer)

      let storedBuffer = null

      mocks.findOne.mockResolvedValue(
        recording,
      )

      mocks.saveBuffer
        .mockImplementation(
          async (input) => {
            storedBuffer =
              Buffer.from(
                input.buffer,
              )

            return storageMetadata
          },
        )

      mocks.findOneAndUpdate
        .mockResolvedValue(
          createStoredDocument(),
        )

      const result =
        await storeMemoryRecordingFile(
          userId,
          memoryId,
          recordingId,
          file,
        )

      expect(
        mocks.requireMemoryPermission,
      ).toHaveBeenCalledWith(
        userId,
        memoryId,
        'contribute',
      )

      expect(
        mocks.saveBuffer,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          memoryId,
          recordingId,
          mimeType: 'audio/webm',
        }),
      )

      expect(storedBuffer).toEqual(
        originalBuffer,
      )

      expect(
        mocks.findOneAndUpdate,
      ).toHaveBeenCalledWith(
        {
          _id: recording._id,
          memoryId,
          uploadedByUserId: userId,
          lifecycleStatus: 'active',
          storageStatus: 'pending',
        },
        {
          $set: {
            storageStatus: 'stored',
            storageProvider:
              'local_private',
            storageKey:
              storageMetadata
                .storageKey,
            sizeBytes: 8,
            checksumSha256:
              storageMetadata
                .checksumSha256,
          },
          $unset: {
            storageFailureCode: 1,
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        },
      )

      expect(result).toEqual(
        publicRecording,
      )

      expect(file.buffer).toEqual(
        Buffer.alloc(8),
      )
    })

    it('stops before database and storage access when permission is denied', async () => {
      const file = createFile()

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
        storeMemoryRecordingFile(
          userId,
          memoryId,
          recordingId,
          file,
        ),
      ).rejects.toMatchObject({
        code: 'MEMORY_NOT_FOUND',
      })

      expect(
        mocks.findOne,
      ).not.toHaveBeenCalled()

      expect(
        mocks.saveBuffer,
      ).not.toHaveBeenCalled()

      expect(file.buffer).toEqual(
        Buffer.alloc(8),
      )
    })

    it('returns a safe error when the recording is unavailable', async () => {
      const file = createFile()

      mocks.findOne.mockResolvedValue(null)

      await expect(
        storeMemoryRecordingFile(
          userId,
          memoryId,
          recordingId,
          file,
        ),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'RECORDING_NOT_FOUND',
        message:
          'Recording was not found.',
      })

      expect(
        mocks.saveBuffer,
      ).not.toHaveBeenCalled()
    })

    it('rejects a file that does not match its metadata', async () => {
      const file = createFile({
        mimetype: 'audio/wav',
      })

      mocks.findOne.mockResolvedValue(
        createRecording(),
      )

      await expect(
        storeMemoryRecordingFile(
          userId,
          memoryId,
          recordingId,
          file,
        ),
      ).rejects.toMatchObject({
        statusCode: 400,
        code:
          'RECORDING_FILE_MISMATCH',
      })

      expect(
        mocks.saveBuffer,
      ).not.toHaveBeenCalled()
    })

    it('rejects an already stored recording', async () => {
      const file = createFile()

      mocks.findOne.mockResolvedValue(
        createRecording({
          storageStatus: 'stored',
        }),
      )

      await expect(
        storeMemoryRecordingFile(
          userId,
          memoryId,
          recordingId,
          file,
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code:
          'RECORDING_UPLOAD_UNAVAILABLE',
      })

      expect(
        mocks.saveBuffer,
      ).not.toHaveBeenCalled()
    })

    it('marks the recording as failed when private storage fails', async () => {
      const recording =
        createRecording()

      const storageError =
        new AppError(
          'Recording file storage failed.',
          {
            statusCode: 500,
            code:
              'RECORDING_STORAGE_FAILED',
          },
        )

      mocks.findOne.mockResolvedValue(
        recording,
      )

      mocks.saveBuffer
        .mockRejectedValue(
          storageError,
        )

      mocks.findOneAndUpdate
        .mockResolvedValue(null)

      await expect(
        storeMemoryRecordingFile(
          userId,
          memoryId,
          recordingId,
          createFile(),
        ),
      ).rejects.toBe(storageError)

      expect(
        mocks.findOneAndUpdate,
      ).toHaveBeenCalledWith(
        {
          _id: recording._id,
          storageStatus: 'pending',
        },
        {
          $set: {
            storageStatus: 'failed',
            storageFailureCode:
              'RECORDING_STORAGE_FAILED',
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        },
      )
    })

    it('deletes its file when another upload wins the atomic update', async () => {
      const recording =
        createRecording()

      mocks.findOne.mockResolvedValue(
        recording,
      )

      mocks.findOneAndUpdate
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      await expect(
        storeMemoryRecordingFile(
          userId,
          memoryId,
          recordingId,
          createFile(),
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        code:
          'RECORDING_UPLOAD_UNAVAILABLE',
      })

      expect(
        mocks.deleteFile,
      ).toHaveBeenCalledWith(
        storageMetadata.storageKey,
      )
    })

    it('deletes its file when the database update fails', async () => {
      const recording =
        createRecording()

      const databaseError =
        new Error(
          'Database update failed.',
        )

      mocks.findOne.mockResolvedValue(
        recording,
      )

      mocks.findOneAndUpdate
        .mockRejectedValueOnce(
          databaseError,
        )
        .mockResolvedValueOnce(null)

      await expect(
        storeMemoryRecordingFile(
          userId,
          memoryId,
          recordingId,
          createFile(),
        ),
      ).rejects.toBe(databaseError)

      expect(
        mocks.deleteFile,
      ).toHaveBeenCalledWith(
        storageMetadata.storageKey,
      )
    })
  })
