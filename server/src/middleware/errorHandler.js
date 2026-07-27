import { logger } from '../utils/logger.js'

const requestErrors = {
  'entity.parse.failed': {
    statusCode: 400,
    code: 'INVALID_JSON',
    message: 'Request body contains invalid JSON.',
  },
  'entity.too.large': {
    statusCode: 413,
    code: 'PAYLOAD_TOO_LARGE',
    message: 'Request body is too large.',
  },
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error)
    return
  }

  const requestError = requestErrors[error.type]

  const hasValidStatus =
    Number.isInteger(error.statusCode) &&
    error.statusCode >= 400 &&
    error.statusCode <= 599

  const statusCode =
    requestError?.statusCode ??
    (hasValidStatus ? error.statusCode : 500)

  const isOperational = error.isOperational === true

  const code =
    requestError?.code ??
    (isOperational
      ? error.code
      : 'INTERNAL_SERVER_ERROR')

  const message =
    requestError?.message ??
    (isOperational
      ? error.message
      : 'An unexpected error occurred.')

  if (statusCode >= 500) {
    logger.error('Unhandled request error', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      errorName: error.name,
    })
  }

  const responseError = {
    code,
    message,
    requestId: req.requestId,
  }

  if (
    isOperational &&
    Array.isArray(error.details)
  ) {
    responseError.details = error.details
  }

  res.status(statusCode).json({
    success: false,
    error: responseError,
  })
}