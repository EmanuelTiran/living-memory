import request from 'supertest'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { AppError } from '../src/errors/AppError.js'

const mocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  createMemoryAsset: vi.fn(),
  listMemoryAssets: vi.fn(),
  getMemoryAssetFile: vi.fn(),
  archiveMemoryAsset: vi.fn(),
}))

vi.mock(
  '../src/modules/auth/tokens.js',
  () => ({
    verifyAccessToken:
      mocks.verifyAccessToken,
  }),
)

vi.mock(
  '../src/modules/media/memoryAssetService.js',
  () => ({
    createMemoryAsset:
      mocks.createMemoryAsset,
    listMemoryAssets:
      mocks.listMemoryAssets,
    getMemoryAssetFile:
      mocks.getMemoryAssetFile,
    archiveMemoryAsset:
      mocks.archiveMemoryAsset,
  }),
)

import app from '../src/app.js'

const userId =
  '507f1f77bcf86cd799439010'
const memoryId =
  '507f1f77bcf86cd799439011'
const assetId =
  '507f1f77bcf86cd799439012'

const authentication = {
  userId,
  systemRole: 'user',
  tokenId: 'token-id',
  expiresAt: new Date(
    Date.now() + 15 * 60 * 1000,
  ),
}

const publicAsset = {
  id: assetId,
  memoryId,
  displayName: 'Family portrait',
  description: 'At home',
  originalFileName: 'portrait.png',
  assetType: 'image',
  mimeType: 'image/png',
  sizeBytes: 9,
  storageProvider: 'local_private',
  lifecycleStatus: 'active',
}

function createPngBuffer() {
  return Buffer.from([
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
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.verifyAccessToken
    .mockResolvedValue(authentication)
})

describe('Memory asset routes', () => {
  it('lists assets for an authenticated user', async () => {
    mocks.listMemoryAssets
      .mockResolvedValue([publicAsset])

    const response = await request(app)
      .get(
        `/api/memories/${memoryId}/assets`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )

    expect(response.status).toBe(200)
    expect(
      mocks.listMemoryAssets,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
    )
    expect(response.body.data.assets)
      .toEqual([publicAsset])
  })

  it('uploads one validated asset', async () => {
    mocks.createMemoryAsset
      .mockResolvedValue(publicAsset)

    const response = await request(app)
      .post(
        `/api/memories/${memoryId}/assets`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )
      .field('displayName', 'Family portrait')
      .field('description', 'At home')
      .attach('asset', createPngBuffer(), {
        filename: 'portrait.png',
        contentType: 'image/png',
      })

    expect(response.status).toBe(201)
    expect(
      mocks.createMemoryAsset,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
      expect.objectContaining({
        displayName: 'Family portrait',
        description: 'At home',
      }),
      expect.objectContaining({
        originalname: 'portrait.png',
        mimetype: 'image/png',
      }),
    )
    expect(response.body.data.asset)
      .toEqual(publicAsset)
  })

  it('serves a private file inline', async () => {
    const buffer = createPngBuffer()

    mocks.getMemoryAssetFile
      .mockResolvedValue({
        asset: publicAsset,
        buffer,
      })

    const response = await request(app)
      .get(
        `/api/memories/${memoryId}/assets/${assetId}/file`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )

    expect(response.status).toBe(200)
    expect(response.headers['content-type'])
      .toContain('image/png')
    expect(
      response.headers['cache-control'],
    ).toContain('no-store')
    expect(
      response.headers['content-disposition'],
    ).toContain('inline')
    expect(
      mocks.getMemoryAssetFile,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
      assetId,
    )
  })

  it('serves a private file as a download', async () => {
    mocks.getMemoryAssetFile
      .mockResolvedValue({
        asset: publicAsset,
        buffer: createPngBuffer(),
      })

    const response = await request(app)
      .get(
        `/api/memories/${memoryId}/assets/${assetId}/download`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )

    expect(response.status).toBe(200)
    expect(
      response.headers['content-disposition'],
    ).toContain('attachment')
  })

  it('archives metadata without deleting the file route', async () => {
    mocks.archiveMemoryAsset
      .mockResolvedValue({
        ...publicAsset,
        lifecycleStatus: 'archived',
      })

    const response = await request(app)
      .delete(
        `/api/memories/${memoryId}/assets/${assetId}`,
      )
      .set(
        'Authorization',
        'Bearer valid-access-token',
      )

    expect(response.status).toBe(200)
    expect(
      mocks.archiveMemoryAsset,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
      assetId,
    )
  })

  it('requires authentication and valid identifiers', async () => {
    mocks.verifyAccessToken
      .mockRejectedValueOnce(
        new AppError(
          'Authentication is required.',
          {
            statusCode: 401,
            code:
              'AUTHENTICATION_REQUIRED',
          },
        ),
      )

    const unauthorizedResponse =
      await request(app).get(
        `/api/memories/${memoryId}/assets`,
      )

    expect(unauthorizedResponse.status)
      .toBe(401)

    mocks.verifyAccessToken
      .mockReset()
      .mockResolvedValue(authentication)

    const invalidResponse =
      await request(app)
        .get(
          `/api/memories/${memoryId}/assets/invalid/file`,
        )
        .set(
          'Authorization',
          'Bearer valid-access-token',
        )

    expect(invalidResponse.status).toBe(400)
  })
})
