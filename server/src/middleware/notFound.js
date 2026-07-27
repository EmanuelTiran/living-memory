import { AppError } from '../errors/AppError.js'

export function notFound(_req, _res, next) {
  next(
    new AppError('Route not found.', {
      statusCode: 404,
      code: 'ROUTE_NOT_FOUND',
    }),
  )
}