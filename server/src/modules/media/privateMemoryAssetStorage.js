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
  MAX_MEMORY_ASSET_SIZE_BYTES,
  MEMORY_ASSET_MIME_TYPES,
} from './MemoryAsset.js'

export const PRIVATE_MEMORY_ASSET_PROVIDER =
  'local_private'

const objectIdPattern =
  /^[0-9a-f]{24}$/i

const storageIdentifierPattern =
  /^[a-zA-Z0-9-]{1,100}$/

const fileExtensionsByMimeType =
  Object.freeze({
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
  })

function createFileNotFoundError() {
  return new AppError(
    'Memory asset file was not found.',
    {
      statusCode: 404,
      code: 'MEMORY_ASSET_FILE_NOT_FOUND',
    },
  )
}

function createStorageFailureError() {
  return new AppError(
    'Memory asset file storage failed.',
    {
      statusCode: 500,
      code: 'MEMORY_ASSET_STORAGE_FAILED',
    },
  )
}

function validateRootDirectory(rootDirectory) {
  if (
    typeof rootDirectory !== 'string' ||
    rootDirectory.trim().length === 0 ||
    rootDirectory.includes('\u0000')
  ) {
    throw new TypeError(
      'Memory asset storage root is invalid.',
    )
  }

  return resolve(rootDirectory)
}

function validateObjectId(label, value) {
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
  if (!MEMORY_ASSET_MIME_TYPES.includes(mimeType)) {
    throw new TypeError(
      'Memory asset MIME type is not supported.',
    )
  }
}

function validateBuffer(buffer) {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length === 0 ||
    buffer.length > MAX_MEMORY_ASSET_SIZE_BYTES
  ) {
    throw new TypeError(
      'Memory asset content is invalid.',
    )
  }
}

function resolveStoragePath(
  rootDirectory,
  storageKey,
) {
  if (
    typeof storageKey !== 'string' ||
    storageKey.length === 0 ||
    storageKey.includes('\u0000') ||
    storageKey.includes('\\') ||
    isAbsolute(storageKey)
  ) {
    throw new TypeError(
      'Memory asset storage key is invalid.',
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
      'Memory asset storage key is invalid.',
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
      'Memory asset storage key escapes the private storage root.',
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

export function createPrivateMemoryAssetStorage({
  rootDirectory =
    env.memoryAssetStorageRoot,
  generateIdentifier = randomUUID,
} = {}) {
  const resolvedRootDirectory =
    validateRootDirectory(rootDirectory)

  if (
    typeof generateIdentifier !== 'function'
  ) {
    throw new TypeError(
      'Storage identifier generator must be a function.',
    )
  }

  function createStorageKey({
    memoryId,
    assetId,
    mimeType,
  }) {
    validateObjectId('Memory ID', memoryId)
    validateObjectId('Asset ID', assetId)
    validateMimeType(mimeType)

    const identifier = generateIdentifier()

    if (
      typeof identifier !== 'string' ||
      !storageIdentifierPattern.test(identifier)
    ) {
      throw new TypeError(
        'Generated storage identifier is invalid.',
      )
    }

    return [
      memoryId,
      assetId,
      `${identifier}${fileExtensionsByMimeType[mimeType]}`,
    ].join('/')
  }

  async function saveBuffer({
    memoryId,
    assetId,
    mimeType,
    buffer,
  }) {
    validateBuffer(buffer)

    const storageKey = createStorageKey({
      memoryId,
      assetId,
      mimeType,
    })

    const filePath = resolveStoragePath(
      resolvedRootDirectory,
      storageKey,
    )

    try {
      await mkdir(dirname(filePath), {
        recursive: true,
        mode: 0o700,
      })

      await writeFile(filePath, buffer, {
        flag: 'wx',
        mode: 0o600,
      })
    } catch {
      throw createStorageFailureError()
    }

    return Object.freeze({
      storageProvider:
        PRIVATE_MEMORY_ASSET_PROVIDER,
      storageKey,
      sizeBytes: buffer.length,
      checksumSha256:
        createChecksum(buffer),
    })
  }

  async function readBuffer(storageKey) {
    const filePath = resolveStoragePath(
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
    const filePath = resolveStoragePath(
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
      PRIVATE_MEMORY_ASSET_PROVIDER,
    saveBuffer,
    readBuffer,
    deleteFile,
  })
}

export const privateMemoryAssetStorage =
  createPrivateMemoryAssetStorage()
