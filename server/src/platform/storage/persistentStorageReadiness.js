import {
  access,
  mkdir,
} from 'node:fs/promises'
import { constants } from 'node:fs'
import { env } from '../../config/env.js'

const storageRoots = Object.freeze([
  env.recordingStorageRoot,
  env.memoryAssetStorageRoot,
])

async function ensureWritableDirectory(root) {
  await mkdir(root, {
    recursive: true,
  })
  await access(
    root,
    constants.R_OK | constants.W_OK,
  )
}

export async function ensurePersistentStorageReady() {
  await Promise.all(
    storageRoots.map(
      ensureWritableDirectory,
    ),
  )
}

export async function isPersistentStorageReady() {
  try {
    await Promise.all(
      storageRoots.map((root) =>
        access(
          root,
          constants.R_OK | constants.W_OK,
        ),
      ),
    )

    return true
  } catch {
    return false
  }
}
