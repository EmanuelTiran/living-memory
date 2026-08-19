import multer from 'multer'
import { AppError } from '../../errors/AppError.js'
import {
  RECORDING_MIME_TYPES,
} from '../media/MemoryRecording.js'
import {
  isRecordingContentCompatibleWithMimeType,
} from '../media/recordingAudioFormat.js'

export const CHAT_VOICE_INPUT_FIELD =
  'audio'

export const CHAT_VOICE_INPUT_MAX_FILE_SIZE_BYTES =
  10 * 1024 * 1024

const memoryStorage =
  multer.memoryStorage()

function createUploadError(
  message,
  {
    statusCode = 400,
    code =
      'INVALID_CHAT_VOICE_INPUT',
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
        'Chat voice input type is not supported.',
        {
          code:
            'CHAT_VOICE_INPUT_TYPE_UNSUPPORTED',
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
      CHAT_VOICE_INPUT_MAX_FILE_SIZE_BYTES,
    files: 1,
    fields: 0,
    fieldNameSize: 100,
  },
}).single(CHAT_VOICE_INPUT_FIELD)

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
      'Chat voice input must not exceed 10 MB.',
      {
        statusCode: 413,
        code:
          'CHAT_VOICE_INPUT_FILE_TOO_LARGE',
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
      'Upload exactly one audio file using the audio field.',
      {
        code:
          'CHAT_VOICE_INPUT_FILE_COUNT_INVALID',
      },
    )
  }

  return createUploadError(
    'Chat voice input upload is invalid.',
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

export function discardChatVoiceInput(
  req,
) {
  discardFile(req)
}

export function uploadChatVoiceInput(
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
          'A chat voice input file is required.',
          {
            code:
              'CHAT_VOICE_INPUT_REQUIRED',
          },
        ),
      )

      return
    }

    if (
      !isRecordingContentCompatibleWithMimeType(
        req.file.mimetype,
        req.file.buffer,
      )
    ) {
      discardFile(req)

      next(
        createUploadError(
          'Chat voice input content does not match its declared type.',
          {
            code:
              'CHAT_VOICE_INPUT_CONTENT_INVALID',
          },
        ),
      )

      return
    }

    next()
  })
}
