import {
    createHash,
    randomUUID,
  } from 'node:crypto'
  import {
    lstat,
    mkdir,
    readFile,
    unlink,
    writeFile,
  } from 'node:fs/promises'
  import {
    dirname,
    isAbsolute,
    relative,
    resolve,
  } from 'node:path'
  import { env } from '../../config/env.js'
  import { AppError } from '../../errors/AppError.js'
  import {
    MAX_RECORDING_SIZE_BYTES,
    RECORDING_MIME_TYPES,
  } from './MemoryRecording.js'

  export const PRIVATE_RECORDING_PROVIDER =
    'local_private'

  const objectIdPattern =
    /^[0-9a-f]{24}$/i

  const storageIdentifierPattern =
    /^[a-zA-Z0-9-]{1,100}$/

  const fileExtensionsByMimeType =
    Object.freeze({
      'audio/mpeg': '.mp3',
      'audio/mp4': '.m4a',
      'audio/x-m4a': '.m4a',
      'audio/wav': '.wav',
      'audio/x-wav': '.wav',
      'audio/webm': '.webm',
    })

  function createFileNotFoundError() {
    return new AppError(
      'Recording file was not found.',
      {
        statusCode: 404,
        code:
          'RECORDING_FILE_NOT_FOUND',
      },
    )
  }

  function createStorageFailureError() {
    return new AppError(
      'Recording file storage failed.',
      {
        statusCode: 500,
        code:
          'RECORDING_STORAGE_FAILED',
      },
    )
  }

  function validateRootDirectory(
    rootDirectory,
  ) {
    if (
      typeof rootDirectory !== 'string' ||
      rootDirectory.trim().length === 0
    ) {
      throw new TypeError(
        'Recording storage root must be a non-empty string.',
      )
    }

    if (
      rootDirectory.includes('\u0000')
    ) {
      throw new TypeError(
        'Recording storage root contains invalid characters.',
      )
    }

    return resolve(rootDirectory)
  }

  function validateObjectId(
    label,
    value,
  ) {
    if (
      typeof value !== 'string' ||
      !objectIdPattern.test(value)
    ) {
      throw new TypeError(
        `${label} must be a valid identifier.`,
      )
    }
  }

  function validateMimeType(mimeType) {
    if (
      !RECORDING_MIME_TYPES.includes(
        mimeType,
      )
    ) {
      throw new TypeError(
        'Recording MIME type is not supported.',
      )
    }
  }

  function validateBuffer(buffer) {
    if (!Buffer.isBuffer(buffer)) {
      throw new TypeError(
        'Recording content must be a buffer.',
      )
    }

    if (buffer.length === 0) {
      throw new TypeError(
        'Recording content must not be empty.',
      )
    }

    if (
      buffer.length >
      MAX_RECORDING_SIZE_BYTES
    ) {
      throw new TypeError(
        'Recording content must not exceed 25 MB.',
      )
    }
  }

  function validateGeneratedIdentifier(
    identifier,
  ) {
    if (
      typeof identifier !== 'string' ||
      !storageIdentifierPattern.test(
        identifier,
      )
    ) {
      throw new TypeError(
        'Generated storage identifier is invalid.',
      )
    }
  }

  function resolveStoragePath(
    rootDirectory,
    storageKey,
  ) {
    if (
      typeof storageKey !== 'string' ||
      storageKey.length === 0
    ) {
      throw new TypeError(
        'Recording storage key must be a non-empty string.',
      )
    }

    if (
      storageKey.includes('\u0000') ||
      storageKey.includes('\\') ||
      isAbsolute(storageKey)
    ) {
      throw new TypeError(
        'Recording storage key is invalid.',
      )
    }

    const segments = storageKey.split('/')

    if (
      segments.some(
        (segment) =>
          segment.length === 0 ||
          segment === '.' ||
          segment === '..',
      )
    ) {
      throw new TypeError(
        'Recording storage key is invalid.',
      )
    }

    const filePath = resolve(
      rootDirectory,
      ...segments,
    )

    const relativePath = relative(
      rootDirectory,
      filePath,
    )

    if (
      relativePath.startsWith('..') ||
      isAbsolute(relativePath)
    ) {
      throw new TypeError(
        'Recording storage key escapes the private storage root.',
      )
    }

    return filePath
  }

  async function getFileStatus(filePath) {
    try {
      return await lstat(filePath)
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return null
      }

      throw createStorageFailureError()
    }
  }

  function createChecksum(buffer) {
    return createHash('sha256')
      .update(buffer)
      .digest('hex')
  }

  export function createPrivateRecordingStorage({
    rootDirectory =
      env.recordingStorageRoot,
    generateIdentifier = randomUUID,
  } = {}) {
    const resolvedRootDirectory =
      validateRootDirectory(
        rootDirectory,
      )

    if (
      typeof generateIdentifier !==
      'function'
    ) {
      throw new TypeError(
        'Storage identifier generator must be a function.',
      )
    }

    function createStorageKey({
      memoryId,
      recordingId,
      mimeType,
    }) {
      validateObjectId(
        'Memory ID',
        memoryId,
      )

      validateObjectId(
        'Recording ID',
        recordingId,
      )

      validateMimeType(mimeType)

      const identifier =
        generateIdentifier()

      validateGeneratedIdentifier(
        identifier,
      )

      const extension =
        fileExtensionsByMimeType[
          mimeType
        ]

      return [
        memoryId,
        recordingId,
        `${identifier}${extension}`,
      ].join('/')
    }

    async function saveBuffer({
      memoryId,
      recordingId,
      mimeType,
      buffer,
    }) {
      validateBuffer(buffer)

      const storageKey =
        createStorageKey({
          memoryId,
          recordingId,
          mimeType,
        })

      const filePath =
        resolveStoragePath(
          resolvedRootDirectory,
          storageKey,
        )

      try {
        await mkdir(dirname(filePath), {
          recursive: true,
          mode: 0o700,
        })

        await writeFile(
          filePath,
          buffer,
          {
            flag: 'wx',
            mode: 0o600,
          },
        )
      } catch {
        throw createStorageFailureError()
      }

      return Object.freeze({
        storageProvider:
          PRIVATE_RECORDING_PROVIDER,
        storageKey,
        sizeBytes: buffer.length,
        checksumSha256:
          createChecksum(buffer),
      })
    }

    async function readBuffer(storageKey) {
      const filePath =
        resolveStoragePath(
          resolvedRootDirectory,
          storageKey,
        )

      const fileStatus =
        await getFileStatus(filePath)

      if (
        !fileStatus ||
        !fileStatus.isFile() ||
        fileStatus.isSymbolicLink()
      ) {
        throw createFileNotFoundError()
      }

      try {
        return await readFile(filePath)
      } catch (error) {
        if (error?.code === 'ENOENT') {
          throw createFileNotFoundError()
        }

        throw createStorageFailureError()
      }
    }

    async function deleteFile(storageKey) {
      const filePath =
        resolveStoragePath(
          resolvedRootDirectory,
          storageKey,
        )

      const fileStatus =
        await getFileStatus(filePath)

      if (!fileStatus) {
        return false
      }

      if (
        !fileStatus.isFile() ||
        fileStatus.isSymbolicLink()
      ) {
        throw createFileNotFoundError()
      }

      try {
        await unlink(filePath)
        return true
      } catch (error) {
        if (error?.code === 'ENOENT') {
          return false
        }

        throw createStorageFailureError()
      }
    }

    return Object.freeze({
      provider:
        PRIVATE_RECORDING_PROVIDER,
      saveBuffer,
      readBuffer,
      deleteFile,
    })
  }

  export const privateRecordingStorage =
    createPrivateRecordingStorage()
