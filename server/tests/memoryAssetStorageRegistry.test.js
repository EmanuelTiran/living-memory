import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { createMemoryAssetStorageRegistry } from '../src/modules/media/memoryAssetStorageRegistry.js'

function createAdapter(provider) {
  return Object.freeze({
    provider,
    saveBuffer: vi.fn(),
    readBuffer: vi.fn(),
    deleteFile: vi.fn(),
  })
}

describe(
  'Memory asset storage registry',
  () => {
    it(
      'selects a primary adapter and resolves stored provider names',
      () => {
        const local =
          createAdapter('local_private')
        const secondary =
          createAdapter('secondary_private')

        const registry =
          createMemoryAssetStorageRegistry(
            [local, secondary],
            {
              primaryProvider:
                'secondary_private',
            },
          )

        expect(registry.primary).toBe(
          secondary,
        )
        expect(
          registry.get('local_private'),
        ).toBe(local)
      },
    )

    it(
      'fails safely when a stored provider is unavailable',
      () => {
        const registry =
          createMemoryAssetStorageRegistry([
            createAdapter('local_private'),
          ])

        expect(() =>
          registry.get('missing_provider'),
        ).toThrowError(
          expect.objectContaining({
            statusCode: 503,
            code:
              'MEMORY_ASSET_STORAGE_PROVIDER_UNAVAILABLE',
          }),
        )
      },
    )
  },
)
