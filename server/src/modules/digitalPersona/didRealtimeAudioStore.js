import { randomUUID } from 'node:crypto'
import { AppError } from '../../errors/AppError.js'

const RESOURCE_TTL_MS =
  15 * 60 * 1000
const MAX_RESOURCE_COUNT = 40

const resources = new Map()

function createNotFoundError() {
  return new AppError(
    'The realtime avatar audio resource was not found or has expired.',
    {
      statusCode: 404,
      code:
        'DID_REALTIME_AUDIO_NOT_FOUND',
    },
  )
}

function removeResource(token) {
  const resource = resources.get(token)

  if (!resource) {
    return null
  }

  clearResourceTimeout(
    resource.timeoutHandle,
  )
  resources.delete(token)

  return resource
}

function clearResourceTimeout(handle) {
  if (handle) {
    clearTimeout(handle)
  }
}

function removeOldestResource() {
  const oldest = [...resources.values()]
    .sort(
      (left, right) =>
        left.createdAt - right.createdAt,
    )[0]

  if (!oldest) {
    return
  }

  const removed = removeResource(
    oldest.token,
  )

  if (removed) {
    void Promise.resolve(
      removed.onExpire(
        removed.resourceId,
      ),
    ).catch(() => {})
  }
}

export function createDIDRealtimeAudioGrant({
  userId,
  memoryId,
  conversationId,
  messageId,
  resourceId,
  onExpire,
}) {
  while (
    resources.size >=
    MAX_RESOURCE_COUNT
  ) {
    removeOldestResource()
  }

  const token = randomUUID()
  const createdAt = Date.now()

  const resource = {
    token,
    userId,
    memoryId,
    conversationId,
    messageId,
    resourceId,
    onExpire,
    createdAt,
    expiresAt:
      createdAt + RESOURCE_TTL_MS,
    timeoutHandle: null,
  }

  resource.timeoutHandle = setTimeout(
    () => {
      const expired = removeResource(token)

      if (expired) {
        void Promise.resolve(
          expired.onExpire(
            expired.resourceId,
          ),
        ).catch(() => {})
      }
    },
    RESOURCE_TTL_MS,
  )

  resource.timeoutHandle.unref?.()
  resources.set(token, resource)

  return token
}

export function takeDIDRealtimeAudioGrant({
  token,
  userId,
  memoryId,
}) {
  const resource = resources.get(token)

  if (
    !resource ||
    resource.userId !== userId ||
    resource.memoryId !== memoryId
  ) {
    throw createNotFoundError()
  }

  removeResource(token)

  return {
    resourceId: resource.resourceId,
  }
}

export function resetDIDRealtimeAudioGrantsForTests() {
  for (const token of resources.keys()) {
    removeResource(token)
  }
}
