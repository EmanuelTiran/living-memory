import { createHash } from 'node:crypto'
import { AppError } from '../../errors/AppError.js'
import {
  cancelProcessingJob,
  enqueueProcessingJob,
  getProcessingJobId,
} from '../../platform/jobs/processingJobService.js'
import MemoryAsset from './MemoryAsset.js'
import { parseMemoryAssetMetadata } from './memoryAssetMetadataParser.js'
import { memoryAssetStorageRegistry } from './memoryAssetStorage.js'

export const MEMORY_ASSET_PARSE_JOB_TYPE =
  'memory_asset_parse'

function createAssetNotFoundError() {
  return new AppError(
    'Memory asset was not found for processing.',
    {
      statusCode: 404,
      code: 'MEMORY_ASSET_NOT_FOUND',
    },
  )
}

function createAssetIntegrityError() {
  return new AppError(
    'Memory asset integrity verification failed during processing.',
    {
      statusCode: 409,
      code:
        'MEMORY_ASSET_FILE_CORRUPTED',
    },
  )
}

function resolveJobObjectId(job) {
  return job?._id ??
    getProcessingJobId(job)
}

function createChecksum(buffer) {
  return createHash('sha256')
    .update(buffer)
    .digest('hex')
}

export async function enqueueMemoryAssetProcessing({
  memoryId,
  assetId,
  checksumSha256,
  mimeType,
}) {
  const job = await enqueueProcessingJob({
    memoryId,
    jobType:
      MEMORY_ASSET_PARSE_JOB_TYPE,
    idempotencyKey:
      `memory-asset:${assetId}:${checksumSha256}`,
    resourceType: 'memory_asset',
    resourceId: assetId,
    payload: {
      memoryId,
      assetId,
      checksumSha256,
      mimeType,
    },
    maxAttempts: 3,
    availableAt: new Date(
      Date.now() + 1_000,
    ),
  })

  return Object.freeze({
    id: getProcessingJobId(job),
  })
}

export async function cancelMemoryAssetProcessing(
  jobId,
) {
  return cancelProcessingJob(jobId)
}

async function processMemoryAsset({
  job,
  updateProgress,
}) {
  const {
    memoryId,
    assetId,
    checksumSha256,
    mimeType,
  } = job.payload
  const jobObjectId =
    resolveJobObjectId(job)

  const asset =
    await MemoryAsset.findOne({
      _id: assetId,
      memoryId,
      lifecycleStatus: 'active',
      processingJobId: jobObjectId,
    }).select(
      '+storageKey +checksumSha256 +processingJobId',
    )

  if (!asset) {
    throw createAssetNotFoundError()
  }

  async function reportProgress(
    progress,
  ) {
    await updateProgress(progress)

    await MemoryAsset.updateOne(
      {
        _id: assetId,
        memoryId,
        processingJobId: jobObjectId,
        lifecycleStatus: 'active',
      },
      {
        $set: {
          processingStatus:
            'processing',
        },
        $max: {
          processingProgress:
            progress,
        },
      },
      {
        runValidators: true,
      },
    )
  }

  await MemoryAsset.updateOne(
    {
      _id: assetId,
      memoryId,
      processingJobId: jobObjectId,
    },
    {
      $set: {
        processingStatus:
          'processing',
        processingProgress: 10,
      },
      $unset: {
        processingFailureCode: 1,
        processedAt: 1,
      },
    },
    {
      runValidators: true,
    },
  )

  await reportProgress(10)

  const storage =
    memoryAssetStorageRegistry.get(
      asset.storageProvider,
    )
  let buffer = null

  try {
    buffer = await storage.readBuffer(
      asset.storageKey,
    )

    if (
      buffer.length !== asset.sizeBytes ||
      createChecksum(buffer) !==
        asset.checksumSha256 ||
      checksumSha256 !==
        asset.checksumSha256 ||
      mimeType !== asset.mimeType
    ) {
      throw createAssetIntegrityError()
    }

    await reportProgress(55)

    const technicalMetadata =
      parseMemoryAssetMetadata(
        buffer,
        asset.mimeType,
      )

    await reportProgress(85)

    const processedAt = new Date()
    const updatedAsset =
      await MemoryAsset.findOneAndUpdate(
        {
          _id: assetId,
          memoryId,
          lifecycleStatus: 'active',
          processingJobId:
            jobObjectId,
        },
        {
          $set: {
            processingStatus:
              'completed',
            processingProgress: 100,
            technicalMetadata,
            processedAt,
          },
          $unset: {
            processingFailureCode: 1,
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        },
      )

    if (!updatedAsset) {
      throw createAssetNotFoundError()
    }

    return technicalMetadata
  } finally {
    if (Buffer.isBuffer(buffer)) {
      buffer.fill(0)
    }
  }
}

async function handleMemoryAssetFailure({
  job,
  settledJob,
}) {
  const isTerminal =
    settledJob.status === 'failed'
  const jobObjectId =
    resolveJobObjectId(job)

  await MemoryAsset.updateOne(
    {
      _id: job.payload.assetId,
      memoryId: job.payload.memoryId,
      processingJobId: jobObjectId,
      lifecycleStatus: 'active',
    },
    isTerminal
      ? {
          $set: {
            processingStatus:
              'failed',
            processingFailureCode:
              settledJob.lastErrorCode ??
              'PROCESSING_JOB_FAILED',
          },
        }
      : {
          $set: {
            processingStatus:
              'queued',
          },
          $unset: {
            processingFailureCode: 1,
          },
        },
    {
      runValidators: true,
    },
  )
}

export const memoryAssetProcessingHandler =
  Object.freeze({
    run: processMemoryAsset,
    onFailure:
      handleMemoryAssetFailure,
  })
