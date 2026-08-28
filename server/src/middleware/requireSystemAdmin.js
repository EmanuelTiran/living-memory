import mongoose from 'mongoose'
import { AppError } from '../errors/AppError.js'
import User from '../modules/auth/User.js'

function createAdminAccessError() {
  return new AppError(
    'Administrator access is required.',
    {
      statusCode: 403,
      code: 'ADMIN_ACCESS_REQUIRED',
    },
  )
}

export async function requireSystemAdmin(
  req,
  _res,
  next,
) {
  if (
    req.auth?.systemRole !== 'admin' ||
    !mongoose.isValidObjectId(
      req.auth?.userId,
    )
  ) {
    next(createAdminAccessError())
    return
  }

  try {
    const activeAdmin = await User.exists({
      _id: req.auth.userId,
      systemRole: 'admin',
      status: 'active',
    })

    if (!activeAdmin) {
      next(createAdminAccessError())
      return
    }

    next()
  } catch (error) {
    next(error)
  }
}
