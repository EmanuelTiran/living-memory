import { createHash } from 'node:crypto'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  findAsset: vi.fn(),
  updateAsset: vi.fn(),
  completeAsset: vi.fn(),
  readBuffer: vi.fn(),
  enqueueJob: vi.fn(),
  cancelJob: vi.fn(),
}))

vi.mock(
  '../src/modules/media/MemoryAsset.js',
  () => ({
    default: {
      findOne: mocks.findAsset,
      updateOne: mocks.updateAsset,
      findOneAndUpdate:
        mocks.completeAsset,
    },
  }),
)

vi.mock(
  '../src/modules/media/memoryAssetStorage.js',
  () => ({
    memoryAssetStorageRegistry: {
      get: vi.fn(() => ({
        readBuffer: mocks.readBuffer,
      })),
    },
  }),
)

vi.mock(
  '../src/platform/jobs/processingJobService.js',
  () => ({
    enqueueProcessingJob:
      mocks.enqueueJob,
    cancelProcessingJob:
      mocks.cancelJob,
    getProcessingJobId: vi.fn(
      (job) => job.id,
    ),
  }),
)

import {
  enqueueMemoryAssetProcessing,
  memoryAssetProcessingHandler,
} from '../src/modules/media/memoryAssetProcessingService.js'

const memoryId =
  '507f1f77bcf86cd799439010'
const assetId =
  '507f1f77bcf86cd799439011'
const jobId =
  '507f1f77bcf86cd799439012'

function createPngBuffer() {
  const buffer = Buffer.alloc(24)

  Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
  ]).copy(buffer)
  buffer.writeUInt32BE(13, 8)
  buffer.write('IHDR', 12, 'ascii')
  buffer.writeUInt32BE(640, 16)
  buffer.writeUInt32BE(480, 20)

  return buffer
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.updateAsset.mockResolvedValue({
    matchedCount: 1,
  })
  mocks.completeAsset.mockResolvedValue({
    id: assetId,
  })
})

describe(
  'Memory asset processing service',
  () => {
    it('enqueues the same asset version with an idempotency key', async () => {
      const checksumSha256 =
        'a'.repeat(64)

      mocks.enqueueJob
        .mockResolvedValue({
          id: jobId,
        })

      await expect(
        enqueueMemoryAssetProcessing({
          memoryId,
          assetId,
          checksumSha256,
          mimeType: 'image/png',
        }),
      ).resolves.toEqual({
        id: jobId,
      })

      expect(mocks.enqueueJob)
        .toHaveBeenCalledWith(
          expect.objectContaining({
            jobType:
              'memory_asset_parse',
            idempotencyKey:
              `memory-asset:${assetId}:${checksumSha256}`,
            resourceType:
              'memory_asset',
            resourceId: assetId,
            maxAttempts: 3,
          }),
        )
    })

    it('verifies, parses, and clears a private file buffer', async () => {
      const sourceBuffer =
        createPngBuffer()
      const storedBuffer =
        Buffer.from(sourceBuffer)
      const checksumSha256 =
        createHash('sha256')
          .update(sourceBuffer)
          .digest('hex')
      const select = vi.fn()
        .mockResolvedValue({
          storageProvider:
            'local_private',
          storageKey:
            'private/asset.png',
          checksumSha256,
          sizeBytes:
            sourceBuffer.length,
          mimeType: 'image/png',
        })

      mocks.findAsset.mockReturnValue({
        select,
      })
      mocks.readBuffer
        .mockResolvedValue(storedBuffer)

      const updateProgress = vi.fn()
        .mockResolvedValue({})

      const result =
        await memoryAssetProcessingHandler
          .run({
            job: {
              _id: jobId,
              payload: {
                memoryId,
                assetId,
                checksumSha256,
                mimeType: 'image/png',
              },
            },
            updateProgress,
          })

      expect(result).toMatchObject({
        parserVersion:
          'asset-metadata-v1',
        widthPixels: 640,
        heightPixels: 480,
      })
      expect(updateProgress.mock.calls)
        .toEqual([
          [10],
          [55],
          [85],
        ])
      expect(mocks.completeAsset)
        .toHaveBeenCalledWith(
          expect.objectContaining({
            _id: assetId,
            memoryId,
            processingJobId: jobId,
          }),
          expect.objectContaining({
            $set:
              expect.objectContaining({
                processingStatus:
                  'completed',
                processingProgress: 100,
              }),
          }),
          expect.any(Object),
        )
      expect(storedBuffer).toEqual(
        Buffer.alloc(
          storedBuffer.length,
        ),
      )
    })
  },
)
