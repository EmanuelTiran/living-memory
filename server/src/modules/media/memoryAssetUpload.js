import multer from 'multer'
import { AppError } from '../../errors/AppError.js'
import {
  MAX_MEMORY_ASSET_SIZE_BYTES,
  MEMORY_ASSET_MIME_TYPES,
} from './MemoryAsset.js'
import { isMemoryAssetContentCompatibleWithMimeType } from './memoryAssetFormat.js'

const MEMORY_ASSET_UPLOAD_FIELD =
  'asset'

function createUploadError(
  message,
  {
    statusCode = 400,
    code = 'INVALID_MEMORY_ASSET_UPLOAD',
  } = {},
) {
  return new AppError(message, {
    statusCode,
    code,
  })
}

function fileFilter(
  _req,
  file,
  callback,
) {
  if (
    !MEMORY_ASSET_MIME_TYPES.includes(
      file.mimetype,
    )
  ) {
    callback(
      createUploadError(
        'Memory asset file type is not supported.',
        {
          code:
            'UNSUPPORTED_MEMORY_ASSET_TYPE',
        },
      ),
    )

    return
  }

  callback(null, true)
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize:
      MAX_MEMORY_ASSET_SIZE_BYTES,
    files: 1,
    fields: 2,
    fieldNameSize: 100,
    fieldSize: 2000,
  },
}).single(MEMORY_ASSET_UPLOAD_FIELD)

function discardFile(req) {
  if (Buffer.isBuffer(req.file?.buffer)) {
    req.file.buffer.fill(0)
  }

  delete req.file
}

function mapMulterError(error) {
  if (!(error instanceof multer.MulterError)) {
    return error
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return createUploadError(
      'Memory asset file must not exceed 10 MB.',
      {
        statusCode: 413,
        code:
          'MEMORY_ASSET_FILE_TOO_LARGE',
      },
    )
  }

  if (
    error.code === 'LIMIT_UNEXPECTED_FILE' ||
    error.code === 'LIMIT_FILE_COUNT'
  ) {
    return createUploadError(
      'Upload exactly one file using the asset field.',
      {
        code:
          'INVALID_MEMORY_ASSET_FILE_COUNT',
      },
    )
  }

  if (
    error.code === 'LIMIT_FIELD_COUNT' ||
    error.code === 'LIMIT_FIELD_VALUE'
  ) {
    return createUploadError(
      'Memory asset metadata is too large.',
      {
        code:
          'INVALID_MEMORY_ASSET_METADATA',
      },
    )
  }

  return createUploadError(
    'Memory asset upload is invalid.',
  )
}

export function uploadMemoryAsset(
  req,
  res,
  next,
) {
  upload(req, res, (error) => {
    if (error) {
      discardFile(req)
      next(mapMulterError(error))
      return
    }

    if (!req.file) {
      next(
        createUploadError(
          'A memory asset file is required.',
          {
            code:
              'MEMORY_ASSET_FILE_REQUIRED',
          },
        ),
      )

      return
    }

    if (
      !isMemoryAssetContentCompatibleWithMimeType(
        req.file.mimetype,
        req.file.buffer,
      )
    ) {
      discardFile(req)

      next(
        createUploadError(
          'Memory asset content does not match its declared file type.',
          {
            code:
              'INVALID_MEMORY_ASSET_CONTENT',
          },
        ),
      )

      return
    }

    next()
  })
}
