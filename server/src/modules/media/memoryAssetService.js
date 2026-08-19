import { createHash } from 'node:crypto'
import { AppError } from '../../errors/AppError.js'
import {
  MEMORY_PERMISSIONS,
  requireMemoryPermission,
} from '../memories/memoryAccessService.js'
import MemoryAsset, {
  getMemoryAssetType,
  MAX_MEMORY_ASSET_SIZE_BYTES,
  MEMORY_ASSET_MIME_TYPES,
} from './MemoryAsset.js'
import { privateMemoryAssetStorage } from './privateMemoryAssetStorage.js'
import {
  memoryAssetFileNameSchema,
  memoryAssetMemoryParamsSchema,
  memoryAssetMetadataSchema,
  memoryAssetParamsSchema,
} from './memoryAssetValidation.js'

function createAssetNotFoundError() {
  return new AppError(
    'Memory asset was not found.',
    {
      statusCode: 404,
      code: 'MEMORY_ASSET_NOT_FOUND',
    },
  )
}

function createFileCorruptedError() {
  return new AppError(
    'Memory asset file integrity check failed.',
    {
      statusCode: 500,
      code:
        'MEMORY_ASSET_FILE_CORRUPTED',
    },
  )
}

function validateUserId(userId) {
  if (
    typeof userId !== 'string' ||
    userId.length === 0
  ) {
    throw new TypeError(
      'User ID must be a non-empty string.',
    )
  }
}

function validateUploadFile(file) {
  if (
    !file ||
    typeof file !== 'object' ||
    !Buffer.isBuffer(file.buffer) ||
    !MEMORY_ASSET_MIME_TYPES.includes(
      file.mimetype,
    ) ||
    !Number.isInteger(file.size) ||
    file.size < 1 ||
    file.size > MAX_MEMORY_ASSET_SIZE_BYTES ||
    file.size !== file.buffer.length
  ) {
    throw new TypeError(
      'Memory asset upload file is invalid.',
    )
  }
}

async function removeStoredFile(storageKey) {
  try {
    await privateMemoryAssetStorage
      .deleteFile(storageKey)
  } catch {
    // An orphan-file cleanup process can retry later.
  }
}

export async function createMemoryAsset(
  userId,
  memoryId,
  metadata,
  file,
) {
  const uploadBuffer = file?.buffer
  let storageMetadata = null

  try {
    validateUserId(userId)
    validateUploadFile(file)

    const validatedMemoryId =
      memoryAssetMemoryParamsSchema.parse({
        memoryId,
      }).memoryId

    const validatedMetadata =
      memoryAssetMetadataSchema.parse({
        displayName:
          metadata?.displayName,
        description:
          metadata?.description ?? '',
      })

    const originalFileName =
      memoryAssetFileNameSchema.parse(
        file.originalname,
      )

    await requireMemoryPermission(
      userId,
      validatedMemoryId,
      MEMORY_PERMISSIONS.CONTRIBUTE,
    )

    const asset = new MemoryAsset({
      memoryId: validatedMemoryId,
      uploadedByUserId: userId,
      displayName:
        validatedMetadata.displayName,
      description:
        validatedMetadata.description,
      originalFileName,
      assetType:
        getMemoryAssetType(file.mimetype),
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storageProvider:
        privateMemoryAssetStorage.provider,
      storageKey: 'pending',
      checksumSha256: '0'.repeat(64),
    })

    storageMetadata =
      await privateMemoryAssetStorage
        .saveBuffer({
          memoryId: validatedMemoryId,
          assetId: asset._id.toString(),
          mimeType: file.mimetype,
          buffer: file.buffer,
        })

    asset.storageProvider =
      storageMetadata.storageProvider
    asset.storageKey =
      storageMetadata.storageKey
    asset.sizeBytes =
      storageMetadata.sizeBytes
    asset.checksumSha256 =
      storageMetadata.checksumSha256

    await asset.save()

    return asset.toJSON()
  } catch (error) {
    if (storageMetadata) {
      await removeStoredFile(
        storageMetadata.storageKey,
      )
    }

    throw error
  } finally {
    if (Buffer.isBuffer(uploadBuffer)) {
      uploadBuffer.fill(0)
    }
  }
}

export async function listMemoryAssets(
  userId,
  memoryId,
) {
  validateUserId(userId)

  const validatedMemoryId =
    memoryAssetMemoryParamsSchema.parse({
      memoryId,
    }).memoryId

  await requireMemoryPermission(
    userId,
    validatedMemoryId,
    MEMORY_PERMISSIONS.VIEW,
  )

  const assets = await MemoryAsset.find({
    memoryId: validatedMemoryId,
    lifecycleStatus: 'active',
  }).sort({
    createdAt: -1,
    _id: -1,
  })

  return assets.map((asset) =>
    asset.toJSON(),
  )
}

export async function getMemoryAssetFile(
  userId,
  memoryId,
  assetId,
) {
  validateUserId(userId)

  const validatedIds =
    memoryAssetParamsSchema.parse({
      memoryId,
      assetId,
    })

  await requireMemoryPermission(
    userId,
    validatedIds.memoryId,
    MEMORY_PERMISSIONS.VIEW,
  )

  const asset = await MemoryAsset.findOne({
    _id: validatedIds.assetId,
    memoryId: validatedIds.memoryId,
    lifecycleStatus: 'active',
  }).select('+storageKey +checksumSha256')

  if (!asset) {
    throw createAssetNotFoundError()
  }

  const buffer =
    await privateMemoryAssetStorage
      .readBuffer(asset.storageKey)

  const checksum = createHash('sha256')
    .update(buffer)
    .digest('hex')

  if (
    buffer.length !== asset.sizeBytes ||
    checksum !== asset.checksumSha256
  ) {
    buffer.fill(0)
    throw createFileCorruptedError()
  }

  return {
    asset: asset.toJSON(),
    buffer,
  }
}

export async function archiveMemoryAsset(
  userId,
  memoryId,
  assetId,
) {
  validateUserId(userId)

  const validatedIds =
    memoryAssetParamsSchema.parse({
      memoryId,
      assetId,
    })

  await requireMemoryPermission(
    userId,
    validatedIds.memoryId,
    MEMORY_PERMISSIONS.EDIT,
  )

  const asset =
    await MemoryAsset.findOneAndUpdate(
      {
        _id: validatedIds.assetId,
        memoryId: validatedIds.memoryId,
        lifecycleStatus: 'active',
      },
      {
        $set: {
          lifecycleStatus: 'archived',
          archivedAt: new Date(),
        },
      },
      {
        returnDocument: 'after',
        runValidators: true,
      },
    )

  if (!asset) {
    throw createAssetNotFoundError()
  }

  return asset.toJSON()
}
