import {
    MEMORY_PERMISSIONS,
    requireMemoryPermission,
  } from '../memories/memoryAccessService.js'

  export async function requireRecordingUploadAccess(
    req,
    _res,
    next,
  ) {
    try {
      await requireMemoryPermission(
        req.auth.userId,
        req.validatedParams.memoryId,
        MEMORY_PERMISSIONS.CONTRIBUTE,
      )

      next()
    } catch (error) {
      next(error)
    }
  }
