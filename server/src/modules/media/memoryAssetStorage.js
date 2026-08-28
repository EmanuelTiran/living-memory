import { privateMemoryAssetStorage } from './privateMemoryAssetStorage.js'
import { createMemoryAssetStorageRegistry } from './memoryAssetStorageRegistry.js'

export const memoryAssetStorageRegistry =
  createMemoryAssetStorageRegistry([
    privateMemoryAssetStorage,
  ])
