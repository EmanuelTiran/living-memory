import multer from 'multer'
import { AppError } from '../../errors/AppError.js'
import {
  MAX_RECORDING_SIZE_BYTES,
  RECORDING_MIME_TYPES,
} from './MemoryRecording.js'
import { isRecordingContentCompatibleWithMimeType } from './recordingAudioFormat.js'

const RECORDING_UPLOAD_FIELD =
  'recording'

const memoryStorage =
  multer.memoryStorage()

function createUploadError(
  message,
  {
    statusCode = 400,
    code =
      'INVALID_RECORDING_UPLOAD',
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
    !RECORDING_MIME_TYPES.includes(
      file.mimetype,
    )
  ) {
    callback(
      createUploadError(
        'Recording file type is not supported.',
        {
          code:
            'UNSUPPORTED_RECORDING_TYPE',
        },
      ),
    )

    return
  }

  callback(null, true)
}

const upload = multer({
  storage: memoryStorage,

  fileFilter,

  limits: {
    fileSize:
      MAX_RECORDING_SIZE_BYTES,

    files: 1,
    fields: 0,
    fieldNameSize: 100,
  },
}).single(RECORDING_UPLOAD_FIELD)

function mapMulterError(error) {
  if (
    !(
      error instanceof
      multer.MulterError
    )
  ) {
    return error
  }

  if (
    error.code ===
    'LIMIT_FILE_SIZE'
  ) {
    return createUploadError(
      'Recording file must not exceed 25 MB.',
      {
        statusCode: 413,
        code:
          'RECORDING_FILE_TOO_LARGE',
      },
    )
  }

  if (
    error.code ===
      'LIMIT_UNEXPECTED_FILE' ||
    error.code ===
      'LIMIT_FILE_COUNT'
  ) {
    return createUploadError(
      'Upload exactly one recording file using the recording field.',
      {
        code:
          'INVALID_RECORDING_FILE_COUNT',
      },
    )
  }

  return createUploadError(
    'Recording upload is invalid.',
  )
}

function validateFileSignature(
  file,
) {
  return isRecordingContentCompatibleWithMimeType(
    file.mimetype,
    file.buffer,
  )
}

function discardFile(req) {
  if (
    Buffer.isBuffer(
      req.file?.buffer,
    )
  ) {
    req.file.buffer.fill(0)
  }

  delete req.file
}

export function uploadRecording(
  req,
  res,
  next,
) {
  upload(req, res, (error) => {
    if (error) {
      next(mapMulterError(error))
      return
    }

    if (!req.file) {
      next(
        createUploadError(
          'A recording file is required.',
          {
            code:
              'RECORDING_FILE_REQUIRED',
          },
        ),
      )

      return
    }

    if (
      !validateFileSignature(
        req.file,
      )
    ) {
      discardFile(req)

      next(
        createUploadError(
          'Recording content does not match its declared file type.',
          {
            code:
              'INVALID_RECORDING_CONTENT',
          },
        ),
      )

      return
    }

    next()
  })
}