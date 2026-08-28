import { AppError } from '../../errors/AppError.js'
import MemoryMembership from './MemoryMembership.js'
import MemoryProfile from './MemoryProfile.js'

export const MEMORY_PERMISSIONS =
  Object.freeze({
    VIEW: 'view',
    CHAT: 'chat',
    CONTRIBUTE: 'contribute',
    EDIT: 'edit',
    MANAGE: 'manage',
  })

const validPermissions = Object.freeze(
  Object.values(MEMORY_PERMISSIONS),
)

const ownerPermissions = Object.freeze([
  MEMORY_PERMISSIONS.VIEW,
  MEMORY_PERMISSIONS.CHAT,
  MEMORY_PERMISSIONS.CONTRIBUTE,
  MEMORY_PERMISSIONS.EDIT,
  MEMORY_PERMISSIONS.MANAGE,
])

const rolePermissions = Object.freeze({
  viewer: Object.freeze([
    MEMORY_PERMISSIONS.VIEW,
    MEMORY_PERMISSIONS.CHAT,
  ]),

  contributor: Object.freeze([
    MEMORY_PERMISSIONS.VIEW,
    MEMORY_PERMISSIONS.CHAT,
    MEMORY_PERMISSIONS.CONTRIBUTE,
  ]),

  editor: Object.freeze([
    MEMORY_PERMISSIONS.VIEW,
    MEMORY_PERMISSIONS.CHAT,
    MEMORY_PERMISSIONS.CONTRIBUTE,
    MEMORY_PERMISSIONS.EDIT,
  ]),

  steward: Object.freeze([
    MEMORY_PERMISSIONS.VIEW,
    MEMORY_PERMISSIONS.CHAT,
    MEMORY_PERMISSIONS.CONTRIBUTE,
    MEMORY_PERMISSIONS.EDIT,
    MEMORY_PERMISSIONS.MANAGE,
  ]),
})

function createMemoryUnavailableError() {
  return new AppError(
    'Memory profile was not found.',
    {
      statusCode: 404,
      code: 'MEMORY_NOT_FOUND',
    },
  )
}

function validateIdentifier(name, value) {
  if (
    typeof value !== 'string' ||
    value.length === 0
  ) {
    throw new TypeError(
      `${name} must be a non-empty string.`,
    )
  }
}

function validatePermission(permission) {
  if (!validPermissions.includes(permission)) {
    throw new TypeError(
      'Memory permission is invalid.',
    )
  }
}

function identifiersMatch(first, second) {
  return first?.toString() === second
}

function createAuthorizationResult({
  memoryProfile,
  role,
  permission,
  accessType,
}) {
  return {
    memoryProfile,
    authorization: {
      accessType,
      role,
      permission,
    },
  }
}

export async function requireMemoryPermission(
  userId,
  memoryId,
  permission,
) {
  validateIdentifier('User ID', userId)
  validateIdentifier('Memory ID', memoryId)
  validatePermission(permission)

  const memoryProfile =
    await MemoryProfile.findOne({
      _id: memoryId,
      status: 'active',
    })

  if (!memoryProfile) {
    throw createMemoryUnavailableError()
  }

  if (
    identifiersMatch(
      memoryProfile.ownerId,
      userId,
    )
  ) {
    if (
      !ownerPermissions.includes(permission)
    ) {
      throw createMemoryUnavailableError()
    }

    return createAuthorizationResult({
      memoryProfile,
      role: 'owner',
      permission,
      accessType: 'owner',
    })
  }

  if (
    memoryProfile.visibility !== 'shared'
  ) {
    throw createMemoryUnavailableError()
  }

  const membership =
    await MemoryMembership.findOne({
      memoryId,
      userId,
      status: 'active',
    })

  const permissions =
    membership
      ? rolePermissions[membership.role]
      : undefined

  if (
    !permissions ||
    !permissions.includes(permission)
  ) {
    throw createMemoryUnavailableError()
  }

  return createAuthorizationResult({
    memoryProfile,
    role: membership.role,
    permission,
    accessType: 'membership',
  })
}

export function assertCanChatWithMemory(
  userId,
  memoryId,
) {
  return requireMemoryPermission(
    userId,
    memoryId,
    MEMORY_PERMISSIONS.CHAT,
  )
}