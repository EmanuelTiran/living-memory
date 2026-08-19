import { createHash } from 'node:crypto'
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
  saveBuffer: vi.fn(),
  readBuffer: vi.fn(),
  deleteFile: vi.fn(),
}))

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
  '../src/modules/media/privateMemoryAssetStorage.js',
  () => ({
    privateMemoryAssetStorage: {
      provider: 'local_private',
      saveBuffer: mocks.saveBuffer,
      readBuffer: mocks.readBuffer,
      deleteFile: mocks.deleteFile,
    },
  }),
)

import MemoryAsset from '../src/modules/media/MemoryAsset.js'
import {
  archiveMemoryAsset,
  createMemoryAsset,
  getMemoryAssetFile,
  listMemoryAssets,
} from '../src/modules/media/memoryAssetService.js'

const userId =
  '507f1f77bcf86cd799439010'
const memoryId =
  '507f1f77bcf86cd799439011'
const assetId =
  '507f1f77bcf86cd799439012'

function createFile() {
  const buffer = Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    0x00,
  ])

  return {
    originalname: 'portrait.png',
    mimetype: 'image/png',
    size: buffer.length,
    buffer,
  }
}

function createPublicAsset() {
  return {
    id: assetId,
    memoryId,
    displayName: 'Family portrait',
    originalFileName: 'portrait.png',
    assetType: 'image',
    mimeType: 'image/png',
    sizeBytes: 9,
    lifecycleStatus: 'active',
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.resetAllMocks()

  mocks.requireMemoryPermission
    .mockResolvedValue({
      authorization: {
        role: 'owner',
      },
    })

  mocks.deleteFile.mockResolvedValue(true)
})

describe('Memory asset service', () => {
  it('stores an authorized upload and clears its in-memory buffer', async () => {
    const file = createFile()
    const originalBuffer = Buffer.from(file.buffer)
    let storedBuffer

    mocks.saveBuffer.mockImplementation(
      async ({ buffer, assetId: savedAssetId }) => {
        storedBuffer = Buffer.from(buffer)

        return {
          storageProvider: 'local_private',
          storageKey:
            `${memoryId}/${savedAssetId}/private.png`,
          sizeBytes: buffer.length,
          checksumSha256:
            createHash('sha256')
              .update(buffer)
              .digest('hex'),
        }
      },
    )

    vi.spyOn(MemoryAsset.prototype, 'save')
      .mockResolvedValue()

    const result = await createMemoryAsset(
      userId,
      memoryId,
      {
        displayName: '  Family portrait  ',
        description: '  At home  ',
      },
      file,
    )

    expect(
      mocks.requireMemoryPermission,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
      'contribute',
    )
    expect(storedBuffer).toEqual(originalBuffer)
    expect(file.buffer).toEqual(
      Buffer.alloc(originalBuffer.length),
    )
    expect(result).toMatchObject({
      displayName: 'Family portrait',
      description: 'At home',
      assetType: 'image',
      mimeType: 'image/png',
      storageProvider: 'local_private',
    })
    expect(result).not.toHaveProperty(
      'storageKey',
    )
  })

  it('does not store a file when contribution access is denied', async () => {
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
      createMemoryAsset(
        userId,
        memoryId,
        {
          displayName: 'Portrait',
          description: '',
        },
        file,
      ),
    ).rejects.toMatchObject({
      code: 'MEMORY_NOT_FOUND',
    })

    expect(mocks.saveBuffer)
      .not.toHaveBeenCalled()
    expect(file.buffer).toEqual(
      Buffer.alloc(file.size),
    )
  })

  it('lists only active assets for an authorized viewer', async () => {
    const publicAsset = createPublicAsset()
    const sort = vi.fn().mockResolvedValue([
      {
        toJSON: () => publicAsset,
      },
    ])

    const find = vi
      .spyOn(MemoryAsset, 'find')
      .mockReturnValue({ sort })

    const result = await listMemoryAssets(
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
    expect(find).toHaveBeenCalledWith({
      memoryId,
      lifecycleStatus: 'active',
    })
    expect(result).toEqual([publicAsset])
  })

  it('verifies file size and SHA-256 before returning content', async () => {
    const buffer = Buffer.from('private file')
    const publicAsset = createPublicAsset()
    const assetDocument = {
      storageKey: 'private/file.png',
      checksumSha256:
        createHash('sha256')
          .update(buffer)
          .digest('hex'),
      sizeBytes: buffer.length,
      toJSON: () => publicAsset,
    }
    const select = vi
      .fn()
      .mockResolvedValue(assetDocument)

    vi.spyOn(MemoryAsset, 'findOne')
      .mockReturnValue({ select })
    mocks.readBuffer
      .mockResolvedValue(Buffer.from(buffer))

    const result = await getMemoryAssetFile(
      userId,
      memoryId,
      assetId,
    )

    expect(result.asset).toEqual(publicAsset)
    expect(result.buffer).toEqual(buffer)

    assetDocument.checksumSha256 =
      'f'.repeat(64)

    await expect(
      getMemoryAssetFile(
        userId,
        memoryId,
        assetId,
      ),
    ).rejects.toMatchObject({
      code:
        'MEMORY_ASSET_FILE_CORRUPTED',
    })
  })

  it('archives metadata with edit permission without deleting storage', async () => {
    const archivedAsset = {
      ...createPublicAsset(),
      lifecycleStatus: 'archived',
    }

    const update = vi
      .spyOn(MemoryAsset, 'findOneAndUpdate')
      .mockResolvedValue({
        toJSON: () => archivedAsset,
      })

    const result = await archiveMemoryAsset(
      userId,
      memoryId,
      assetId,
    )

    expect(
      mocks.requireMemoryPermission,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
      'edit',
    )
    expect(update).toHaveBeenCalledWith(
      {
        _id: assetId,
        memoryId,
        lifecycleStatus: 'active',
      },
      {
        $set: {
          lifecycleStatus: 'archived',
          archivedAt: expect.any(Date),
        },
      },
      {
        returnDocument: 'after',
        runValidators: true,
      },
    )
    expect(mocks.deleteFile)
      .not.toHaveBeenCalled()
    expect(result).toEqual(archivedAsset)
  })
})
