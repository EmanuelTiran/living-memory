import {
    createHash,
  } from 'node:crypto'
  import {
    mkdtemp,
    readFile,
    rm,
  } from 'node:fs/promises'
  import { tmpdir } from 'node:os'
  import {
    join,
  } from 'node:path'
  import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
  } from 'vitest'
  import {
    MAX_RECORDING_SIZE_BYTES,
  } from '../src/modules/media/MemoryRecording.js'
  import {
    createPrivateRecordingStorage,
  } from '../src/modules/media/privateRecordingStorage.js'

  const memoryId =
    '507f1f77bcf86cd799439010'

  const recordingId =
    '507f1f77bcf86cd799439011'

  const generatedIdentifier =
    'fixed-storage-identifier'

  let rootDirectory
  let storage

  beforeEach(async () => {
    rootDirectory = await mkdtemp(
      join(
        tmpdir(),
        'living-memory-recordings-',
      ),
    )

    storage =
      createPrivateRecordingStorage({
        rootDirectory,
        generateIdentifier: () =>
          generatedIdentifier,
      })
  })

  afterEach(async () => {
    await rm(rootDirectory, {
      recursive: true,
      force: true,
    })
  })

  describe('Private recording storage', () => {
    it('stores and reads a recording inside the private root', async () => {
      const buffer = Buffer.from(
        'private recording content',
      )

      const result =
        await storage.saveBuffer({
          memoryId,
          recordingId,
          mimeType: 'audio/webm',
          buffer,
        })

      const expectedStorageKey =
        `${memoryId}/${recordingId}/${generatedIdentifier}.webm`

      expect(result).toEqual({
        storageProvider:
          'local_private',
        storageKey:
          expectedStorageKey,
        sizeBytes: buffer.length,
        checksumSha256:
          createHash('sha256')
            .update(buffer)
            .digest('hex'),
      })

      const storedBuffer =
        await readFile(
          join(
            rootDirectory,
            memoryId,
            recordingId,
            `${generatedIdentifier}.webm`,
          ),
        )

      expect(storedBuffer).toEqual(
        buffer,
      )

      await expect(
        storage.readBuffer(
          expectedStorageKey,
        ),
      ).resolves.toEqual(buffer)
    })

    it('uses a server-generated key and a safe MIME extension', async () => {
      const result =
        await storage.saveBuffer({
          memoryId,
          recordingId,
          mimeType: 'audio/mpeg',
          buffer: Buffer.from('audio'),
        })

      expect(result.storageKey).toBe(
        `${memoryId}/${recordingId}/${generatedIdentifier}.mp3`,
      )

      expect(
        result.storageKey,
      ).not.toContain('original-file-name')
    })

    it('rejects invalid identifiers, types, and file sizes', async () => {
      await expect(
        storage.saveBuffer({
          memoryId: '../outside',
          recordingId,
          mimeType: 'audio/webm',
          buffer: Buffer.from('audio'),
        }),
      ).rejects.toThrow(
        'Memory ID must be a valid identifier.',
      )

      await expect(
        storage.saveBuffer({
          memoryId,
          recordingId,
          mimeType: 'audio/flac',
          buffer: Buffer.from('audio'),
        }),
      ).rejects.toThrow(
        'Recording MIME type is not supported.',
      )

      await expect(
        storage.saveBuffer({
          memoryId,
          recordingId,
          mimeType: 'audio/webm',
          buffer: 'not-a-buffer',
        }),
      ).rejects.toThrow(
        'Recording content must be a buffer.',
      )

      await expect(
        storage.saveBuffer({
          memoryId,
          recordingId,
          mimeType: 'audio/webm',
          buffer: Buffer.alloc(
            MAX_RECORDING_SIZE_BYTES + 1,
          ),
        }),
      ).rejects.toThrow(
        'Recording content must not exceed 25 MB.',
      )
    })

    it('blocks storage-key path traversal', async () => {
      await expect(
        storage.readBuffer(
          '../outside.webm',
        ),
      ).rejects.toThrow(
        'Recording storage key is invalid.',
      )

      await expect(
        storage.readBuffer(
          `${memoryId}\\outside.webm`,
        ),
      ).rejects.toThrow(
        'Recording storage key is invalid.',
      )

      await expect(
        storage.deleteFile(
          `${memoryId}/../outside.webm`,
        ),
      ).rejects.toThrow(
        'Recording storage key is invalid.',
      )
    })

    it('returns a safe error for a missing file', async () => {
      await expect(
        storage.readBuffer(
          `${memoryId}/${recordingId}/missing.webm`,
        ),
      ).rejects.toMatchObject({
        name: 'AppError',
        statusCode: 404,
        code:
          'RECORDING_FILE_NOT_FOUND',
        message:
          'Recording file was not found.',
      })
    })

    it('deletes a stored file idempotently', async () => {
      const result =
        await storage.saveBuffer({
          memoryId,
          recordingId,
          mimeType: 'audio/webm',
          buffer: Buffer.from('audio'),
        })

      await expect(
        storage.deleteFile(
          result.storageKey,
        ),
      ).resolves.toBe(true)

      await expect(
        storage.deleteFile(
          result.storageKey,
        ),
      ).resolves.toBe(false)

      await expect(
        storage.readBuffer(
          result.storageKey,
        ),
      ).rejects.toMatchObject({
        code:
          'RECORDING_FILE_NOT_FOUND',
      })
    })
  })
