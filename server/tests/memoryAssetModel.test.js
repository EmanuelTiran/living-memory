import mongoose from 'mongoose'
import {
  describe,
  expect,
  it,
} from 'vitest'
import MemoryAsset, {
  MAX_MEMORY_ASSET_SIZE_BYTES,
} from '../src/modules/media/MemoryAsset.js'

const memoryId =
  new mongoose.Types.ObjectId()

const userId =
  new mongoose.Types.ObjectId()

function createAssetInput(overrides = {}) {
  return {
    memoryId,
    uploadedByUserId: userId,
    displayName: 'Family portrait',
    description: 'Taken at home',
    originalFileName: 'family.jpg',
    assetType: 'image',
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
    storageProvider: 'local_private',
    storageKey:
      'memory/asset/private.jpg',
    checksumSha256: 'a'.repeat(64),
    ...overrides,
  }
}

describe('MemoryAsset model', () => {
  it('accepts valid private image metadata', async () => {
    const asset = new MemoryAsset(
      createAssetInput(),
    )

    await expect(
      asset.validate(),
    ).resolves.toBeUndefined()

    expect(asset).toMatchObject({
      assetType: 'image',
      lifecycleStatus: 'active',
    })
  })

  it('accepts a PDF document', async () => {
    const asset = new MemoryAsset(
      createAssetInput({
        assetType: 'document',
        mimeType: 'application/pdf',
        originalFileName:
          'family-document.pdf',
      }),
    )

    await expect(
      asset.validate(),
    ).resolves.toBeUndefined()
  })

  it('rejects mismatched types and oversized files', async () => {
    const mismatchedAsset =
      new MemoryAsset(
        createAssetInput({
          assetType: 'document',
        }),
      )

    await expect(
      mismatchedAsset.validate(),
    ).rejects.toThrow(
      'Memory asset type does not match its MIME type.',
    )

    const oversizedAsset =
      new MemoryAsset(
        createAssetInput({
          sizeBytes:
            MAX_MEMORY_ASSET_SIZE_BYTES + 1,
        }),
      )

    await expect(
      oversizedAsset.validate(),
    ).rejects.toThrow()
  })

  it('requires a timestamp when archived', async () => {
    const asset = new MemoryAsset(
      createAssetInput({
        lifecycleStatus: 'archived',
      }),
    )

    await expect(
      asset.validate(),
    ).rejects.toThrow(
      'Archived memory assets require an archive timestamp.',
    )

    asset.archivedAt = new Date()

    await expect(
      asset.validate(),
    ).resolves.toBeUndefined()
  })

  it('does not expose storage secrets or the uploader identifier', async () => {
    const asset = new MemoryAsset(
      createAssetInput(),
    )

    await asset.validate()

    const publicAsset = asset.toJSON()

    expect(publicAsset.id).toBe(
      asset._id.toString(),
    )
    expect(publicAsset).not.toHaveProperty(
      'storageKey',
    )
    expect(publicAsset).not.toHaveProperty(
      'checksumSha256',
    )
    expect(publicAsset).not.toHaveProperty(
      'uploadedByUserId',
    )
  })
})
