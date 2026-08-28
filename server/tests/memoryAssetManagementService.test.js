import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  requireMemoryPermission: vi.fn(),
  assetExists: vi.fn(),
  findOneAndUpdate: vi.fn(),
}))

vi.mock(
  '../src/config/env.js',
  () => ({
    env: {
      accessTokenSecret:
        'test-secret-'.repeat(6),
    },
  }),
)

vi.mock(
  '../src/modules/memories/memoryAccessService.js',
  () => ({
    MEMORY_PERMISSIONS: {
      VIEW: 'view',
      CONTRIBUTE: 'contribute',
      EDIT: 'edit',
    },
    requireMemoryPermission:
      mocks.requireMemoryPermission,
  }),
)

vi.mock(
  '../src/modules/media/MemoryAsset.js',
  () => ({
    default: {
      exists: mocks.assetExists,
      findOneAndUpdate:
        mocks.findOneAndUpdate,
    },
    getMemoryAssetType: (mimeType) =>
      mimeType.startsWith('image/')
        ? 'image'
        : 'document',
    MAX_MEMORY_ASSET_SIZE_BYTES:
      10 * 1024 * 1024,
    MEMORY_ASSET_MIME_TYPES: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ],
  }),
)

vi.mock(
  '../src/modules/media/memoryAssetStorage.js',
  () => {
    const adapter = {
      provider: 'local_private',
      saveBuffer: vi.fn(),
      readBuffer: vi.fn(),
      deleteFile: vi.fn(),
    }

    return {
      memoryAssetStorageRegistry: {
        primary: adapter,
        get: vi.fn(() => adapter),
      },
    }
  },
)

import {
  createMemoryAssetAccessLink,
  updateMemoryAssetMetadata,
} from '../src/modules/media/memoryAssetService.js'

const userId =
  '507f1f77bcf86cd799439010'
const memoryId =
  '507f1f77bcf86cd799439011'
const assetId =
  '507f1f77bcf86cd799439012'

describe(
  'Memory asset management service',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
      mocks.requireMemoryPermission
        .mockResolvedValue({})
      mocks.assetExists
        .mockResolvedValue({
          _id: assetId,
        })
    })

    it(
      'creates a short-lived access link only after view permission succeeds',
      async () => {
        const access =
          await createMemoryAssetAccessLink(
            userId,
            memoryId,
            assetId,
            {
              disposition: 'inline',
            },
          )

        expect(
          mocks.requireMemoryPermission,
        ).toHaveBeenCalledWith(
          userId,
          memoryId,
          'view',
        )

        expect(
          mocks.assetExists,
        ).toHaveBeenCalledWith({
          _id: assetId,
          memoryId,
          lifecycleStatus: 'active',
        })

        expect(access).toEqual({
          url: expect.stringMatching(
            new RegExp(
              `^/api/memories/${memoryId}/assets/${assetId}/access\\?token=`,
            ),
          ),
          expiresAt:
            expect.any(String),
          disposition: 'inline',
        })

        expect(access.url).not.toContain(
          'local_private',
        )
      },
    )

    it(
      'updates editable metadata inside the authorized memory only',
      async () => {
        const updatedAsset = {
          id: assetId,
          displayName:
            'תמונה משפחתית',
          description:
            'צולמה בבית הישן.',
        }

        mocks.findOneAndUpdate
          .mockResolvedValue({
            toJSON: () => updatedAsset,
          })

        const result =
          await updateMemoryAssetMetadata(
            userId,
            memoryId,
            assetId,
            {
              displayName:
                '  תמונה משפחתית  ',
              description:
                '  צולמה בבית הישן.  ',
            },
          )

        expect(
          mocks.requireMemoryPermission,
        ).toHaveBeenCalledWith(
          userId,
          memoryId,
          'edit',
        )

        expect(
          mocks.findOneAndUpdate,
        ).toHaveBeenCalledWith(
          {
            _id: assetId,
            memoryId,
            lifecycleStatus: 'active',
          },
          {
            $set: {
              displayName:
                'תמונה משפחתית',
              description:
                'צולמה בבית הישן.',
            },
          },
          {
            returnDocument: 'after',
            runValidators: true,
          },
        )

        expect(result).toEqual(
          updatedAsset,
        )
      },
    )

    it(
      'does not query an asset when permission is denied',
      async () => {
        mocks.requireMemoryPermission
          .mockRejectedValue(
            Object.assign(
              new Error('Forbidden'),
              {
                statusCode: 403,
                code:
                  'MEMORY_FORBIDDEN',
              },
            ),
          )

        await expect(
          createMemoryAssetAccessLink(
            userId,
            memoryId,
            assetId,
            {
              disposition:
                'attachment',
            },
          ),
        ).rejects.toMatchObject({
          statusCode: 403,
          code: 'MEMORY_FORBIDDEN',
        })

        expect(
          mocks.assetExists,
        ).not.toHaveBeenCalled()
      },
    )
  },
)
