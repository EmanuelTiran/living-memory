import { createHash } from 'node:crypto'
import {
  mkdtemp,
  readFile,
  rm,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import { createPrivateMemoryAssetStorage } from '../src/modules/media/privateMemoryAssetStorage.js'

const memoryId =
  '507f1f77bcf86cd799439010'
const assetId =
  '507f1f77bcf86cd799439011'
const generatedIdentifier =
  'fixed-asset-identifier'

let rootDirectory
let storage

beforeEach(async () => {
  rootDirectory = await mkdtemp(
    join(
      tmpdir(),
      'living-memory-assets-',
    ),
  )

  storage = createPrivateMemoryAssetStorage({
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

describe('Private memory asset storage', () => {
  it('stores and reads a file inside the private root', async () => {
    const buffer = Buffer.from(
      'private image content',
    )

    const result = await storage.saveBuffer({
      memoryId,
      assetId,
      mimeType: 'image/jpeg',
      buffer,
    })

    const expectedStorageKey =
      `${memoryId}/${assetId}/${generatedIdentifier}.jpg`

    expect(result).toEqual({
      storageProvider: 'local_private',
      storageKey: expectedStorageKey,
      sizeBytes: buffer.length,
      checksumSha256:
        createHash('sha256')
          .update(buffer)
          .digest('hex'),
    })

    await expect(
      readFile(
        join(
          rootDirectory,
          memoryId,
          assetId,
          `${generatedIdentifier}.jpg`,
        ),
      ),
    ).resolves.toEqual(buffer)

    await expect(
      storage.readBuffer(
        expectedStorageKey,
      ),
    ).resolves.toEqual(buffer)
  })

  it('uses server-generated names and safe extensions', async () => {
    const result = await storage.saveBuffer({
      memoryId,
      assetId,
      mimeType: 'application/pdf',
      buffer: Buffer.from('document'),
    })

    expect(result.storageKey).toBe(
      `${memoryId}/${assetId}/${generatedIdentifier}.pdf`,
    )
  })

  it('rejects invalid identifiers and MIME types', async () => {
    await expect(
      storage.saveBuffer({
        memoryId: '../outside',
        assetId,
        mimeType: 'image/png',
        buffer: Buffer.from('image'),
      }),
    ).rejects.toThrow(
      'Memory ID must be a valid identifier.',
    )

    await expect(
      storage.saveBuffer({
        memoryId,
        assetId,
        mimeType: 'image/svg+xml',
        buffer: Buffer.from('image'),
      }),
    ).rejects.toThrow(
      'Memory asset MIME type is not supported.',
    )
  })

  it('blocks storage-key path traversal', async () => {
    await expect(
      storage.readBuffer('../outside.pdf'),
    ).rejects.toThrow(
      'Memory asset storage key is invalid.',
    )

    await expect(
      storage.deleteFile(
        `${memoryId}/../outside.pdf`,
      ),
    ).rejects.toThrow(
      'Memory asset storage key is invalid.',
    )
  })

  it('deletes a stored file idempotently', async () => {
    const result = await storage.saveBuffer({
      memoryId,
      assetId,
      mimeType: 'image/webp',
      buffer: Buffer.from('image'),
    })

    await expect(
      storage.deleteFile(result.storageKey),
    ).resolves.toBe(true)

    await expect(
      storage.deleteFile(result.storageKey),
    ).resolves.toBe(false)

    await expect(
      storage.readBuffer(result.storageKey),
    ).rejects.toMatchObject({
      code:
        'MEMORY_ASSET_FILE_NOT_FOUND',
    })
  })
})
