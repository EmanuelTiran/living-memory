import { AppError } from '../errors/AppError.js'

function createValidationDetails(issues) {
  return issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }))
}

export function validateParams(schema) {
  return function validateRequestParams(
    req,
    _res,
    next,
  ) {
    const result = schema.safeParse(
      req.params,
    )

    if (!result.success) {
      next(
        new AppError(
          'Request validation failed.',
          {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            details: createValidationDetails(
              result.error.issues,
            ),
          },
        ),
      )

      return
    }

    req.validatedParams = result.data
    next()
  }
}