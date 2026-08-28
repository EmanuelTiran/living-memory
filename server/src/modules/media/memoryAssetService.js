import { createHash } from 'node:crypto'
import { env } from '../../config/env.js'
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
import { createMemoryAssetAccessTokenService } from './memoryAssetAccessToken.js'
import {
  cancelMemoryAssetProcessing,
  enqueueMemoryAssetProcessing,
} from './memoryAssetProcessingService.js'
import { memoryAssetStorageRegistry } from './memoryAssetStorage.js'
import {
  memoryAssetAccessLinkSchema,
  memoryAssetFileNameSchema,
  memoryAssetMemoryParamsSchema,
  memoryAssetMetadataSchema,
  memoryAssetParamsSchema,
  updateMemoryAssetMetadataSchema,
} from './memoryAssetValidation.js'

const memoryAssetAccessTokenService =
  createMemoryAssetAccessTokenService({
    secret: env.accessTokenSecret,
  })

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

function createAssetAccessInvalidError() {
  return new AppError(
    'Memory asset access link is invalid or expired.',
    {
      statusCode: 403,
      code:
        'MEMORY_ASSET_ACCESS_INVALID',
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

async function removeStoredFile(
  storageProvider,
  storageKey,
) {
  try {
    await memoryAssetStorageRegistry
      .get(storageProvider)
      .deleteFile(storageKey)
  } catch {
    // An orphan-file cleanup process can retry later.
  }
}

async function findActiveAsset(
  validatedIds,
) {
  const asset = await MemoryAsset.findOne({
    _id: validatedIds.assetId,
    memoryId: validatedIds.memoryId,
    lifecycleStatus: 'active',
  }).select('+storageKey +checksumSha256')

  if (!asset) {
    throw createAssetNotFoundError()
  }

  return asset
}

async function readVerifiedAssetFile(asset) {
  const storage =
    memoryAssetStorageRegistry.get(
      asset.storageProvider,
    )

  const buffer =
    await storage.readBuffer(
      asset.storageKey,
    )

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

  return buffer
}

export async function createMemoryAsset(
  userId,
  memoryId,
  metadata,
  file,
) {
  const uploadBuffer = file?.buffer
  let storageMetadata = null
  let processingJobId = null
  const storage =
    memoryAssetStorageRegistry.primary

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
        storage.provider,
      storageKey: 'pending',
      checksumSha256: '0'.repeat(64),
    })

    storageMetadata =
      await storage.saveBuffer({
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

    const processingJob =
      await enqueueMemoryAssetProcessing({
        memoryId: validatedMemoryId,
        assetId: asset._id.toString(),
        checksumSha256:
          storageMetadata.checksumSha256,
        mimeType: file.mimetype,
      })

    processingJobId = processingJob.id
    asset.processingJobId =
      processingJobId
    asset.processingStatus = 'queued'
    asset.processingProgress = 0

    await asset.save()

    return asset.toJSON()
  } catch (error) {
    if (processingJobId) {
      await cancelMemoryAssetProcessing(
        processingJobId,
      ).catch(() => {})
    }

    if (storageMetadata) {
      await removeStoredFile(
        storageMetadata.storageProvider,
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

  const asset = await findActiveAsset(
    validatedIds,
  )

  const buffer =
    await readVerifiedAssetFile(asset)

  return {
    asset: asset.toJSON(),
    buffer,
  }
}

export async function createMemoryAssetAccessLink(
  userId,
  memoryId,
  assetId,
  input,
) {
  validateUserId(userId)

  const validatedIds =
    memoryAssetParamsSchema.parse({
      memoryId,
      assetId,
    })

  const { disposition } =
    memoryAssetAccessLinkSchema.parse(
      input,
    )

  await requireMemoryPermission(
    userId,
    validatedIds.memoryId,
    MEMORY_PERMISSIONS.VIEW,
  )

  const assetExists =
    await MemoryAsset.exists({
      _id: validatedIds.assetId,
      memoryId:
        validatedIds.memoryId,
      lifecycleStatus: 'active',
    })

  if (!assetExists) {
    throw createAssetNotFoundError()
  }

  const accessGrant =
    memoryAssetAccessTokenService.sign({
      memoryId:
        validatedIds.memoryId,
      assetId: validatedIds.assetId,
      disposition,
    })

  const token = encodeURIComponent(
    accessGrant.token,
  )

  return Object.freeze({
    url:
      `/api/memories/${validatedIds.memoryId}/assets/${validatedIds.assetId}/access?token=${token}`,
    expiresAt:
      accessGrant.expiresAt,
    disposition,
  })
}

export async function getMemoryAssetFileWithAccessToken(
  memoryId,
  assetId,
  token,
) {
  const validatedIds =
    memoryAssetParamsSchema.parse({
      memoryId,
      assetId,
    })

  const verifiedGrant =
    memoryAssetAccessTokenService.verify({
      token,
      memoryId:
        validatedIds.memoryId,
      assetId: validatedIds.assetId,
    })

  if (!verifiedGrant) {
    throw createAssetAccessInvalidError()
  }

  const asset = await findActiveAsset(
    validatedIds,
  )

  const buffer =
    await readVerifiedAssetFile(asset)

  return {
    asset: asset.toJSON(),
    buffer,
    disposition:
      verifiedGrant.disposition,
  }
}

export async function updateMemoryAssetMetadata(
  userId,
  memoryId,
  assetId,
  input,
) {
  validateUserId(userId)

  const validatedIds =
    memoryAssetParamsSchema.parse({
      memoryId,
      assetId,
    })

  const metadata =
    updateMemoryAssetMetadataSchema.parse(
      input,
    )

  await requireMemoryPermission(
    userId,
    validatedIds.memoryId,
    MEMORY_PERMISSIONS.EDIT,
  )

  const asset =
    await MemoryAsset.findOneAndUpdate(
      {
        _id: validatedIds.assetId,
        memoryId:
          validatedIds.memoryId,
        lifecycleStatus: 'active',
      },
      {
        $set: metadata,
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
