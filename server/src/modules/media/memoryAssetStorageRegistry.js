import { AppError } from '../../errors/AppError.js'

function validateAdapter(adapter) {
  if (
    !adapter ||
    typeof adapter !== 'object' ||
    typeof adapter.provider !== 'string' ||
    adapter.provider.trim().length === 0 ||
    typeof adapter.saveBuffer !== 'function' ||
    typeof adapter.readBuffer !== 'function' ||
    typeof adapter.deleteFile !== 'function'
  ) {
    throw new TypeError(
      'Memory asset storage adapter is invalid.',
    )
  }
}

function createProviderUnavailableError() {
  return new AppError(
    'Memory asset storage provider is unavailable.',
    {
      statusCode: 503,
      code:
        'MEMORY_ASSET_STORAGE_PROVIDER_UNAVAILABLE',
    },
  )
}

export function createMemoryAssetStorageRegistry(
  adapters,
  {
    primaryProvider,
  } = {},
) {
  if (
    !Array.isArray(adapters) ||
    adapters.length === 0
  ) {
    throw new TypeError(
      'At least one memory asset storage adapter is required.',
    )
  }

  const adaptersByProvider = new Map()

  for (const adapter of adapters) {
    validateAdapter(adapter)

    if (
      adaptersByProvider.has(
        adapter.provider,
      )
    ) {
      throw new TypeError(
        'Memory asset storage provider names must be unique.',
      )
    }

    adaptersByProvider.set(
      adapter.provider,
      adapter,
    )
  }

  const resolvedPrimaryProvider =
    primaryProvider ??
    adapters[0].provider

  if (
    !adaptersByProvider.has(
      resolvedPrimaryProvider,
    )
  ) {
    throw new TypeError(
      'Primary memory asset storage provider is not registered.',
    )
  }

  function get(provider) {
    const adapter =
      adaptersByProvider.get(provider)

    if (!adapter) {
      throw createProviderUnavailableError()
    }

    return adapter
  }

  return Object.freeze({
    primary: get(
      resolvedPrimaryProvider,
    ),
    get,
  })
}
