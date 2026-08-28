import { AppError } from '../../errors/AppError.js'
import {
  MEMORY_PERMISSIONS,
  requireMemoryPermission,
} from '../memories/memoryAccessService.js'
import {
  completeInterviewSession,
} from '../memories/interviewSessionService.js'
import MemoryRecording, {
  MAX_RECORDING_SIZE_BYTES,
  RECORDING_MIME_TYPES,
} from './MemoryRecording.js'
import { privateRecordingStorage } from './privateRecordingStorage.js'
import { memoryRecordingParamsSchema } from './recordingValidation.js'

const uploadableStorageStatuses =
  Object.freeze([
    'pending',
    'failed',
  ])

function createRecordingNotFoundError() {
  return new AppError(
    'Recording was not found.',
    {
      statusCode: 404,
      code: 'RECORDING_NOT_FOUND',
    },
  )
}

function createUploadUnavailableError() {
  return new AppError(
    'Recording is not available for upload.',
    {
      statusCode: 409,
      code:
        'RECORDING_UPLOAD_UNAVAILABLE',
    },
  )
}

function createFileMismatchError() {
  return new AppError(
    'Uploaded file does not match the recording metadata.',
    {
      statusCode: 400,
      code:
        'RECORDING_FILE_MISMATCH',
    },
  )
}

function validateUserId(userId) {
  if (
    typeof userId !== 'string' ||
    userId.length === 0
  ) {
    throw new TypeError(
      'User ID must be a non-empty string.',
    )
  }
}

function validateUploadFile(file) {
  if (
    !file ||
    typeof file !== 'object'
  ) {
    throw new TypeError(
      'Recording upload file is required.',
    )
  }

  if (
    !Buffer.isBuffer(file.buffer)
  ) {
    throw new TypeError(
      'Recording upload content must be a buffer.',
    )
  }

  if (
    !RECORDING_MIME_TYPES.includes(
      file.mimetype,
    )
  ) {
    throw new TypeError(
      'Recording upload type is not supported.',
    )
  }

  if (
    !Number.isInteger(file.size) ||
    file.size < 1 ||
    file.size >
      MAX_RECORDING_SIZE_BYTES
  ) {
    throw new TypeError(
      'Recording upload size is invalid.',
    )
  }

  if (
    file.size !== file.buffer.length
  ) {
    throw new TypeError(
      'Recording upload size does not match its content.',
    )
  }
}

function validateFileMatchesRecording(
  recording,
  file,
) {
  if (
    recording.mimeType !==
      file.mimetype ||
    recording.sizeBytes !== file.size
  ) {
    throw createFileMismatchError()
  }
}

function resolveFailureCode(error) {
  const errorCode =
    typeof error?.code === 'string'
      ? error.code
      : ''

  if (
    /^[A-Z0-9_]{1,80}$/.test(
      errorCode,
    )
  ) {
    return errorCode
  }

  return 'RECORDING_UPLOAD_FAILED'
}

async function markUploadFailed(
  recording,
  error,
) {
  try {
    await MemoryRecording
      .findOneAndUpdate(
        {
          _id: recording._id,
          storageStatus:
            recording.storageStatus,
        },
        {
          $set: {
            storageStatus: 'failed',
            storageFailureCode:
              resolveFailureCode(error),
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        },
      )
  } catch {
    // Preserve the original upload error.
  }
}

async function removeStoredFile(
  storageKey,
) {
  try {
    await privateRecordingStorage
      .deleteFile(storageKey)
  } catch {
    // An orphan-file cleanup process can retry later.
  }
}

async function persistRecordingFile(
  recording,
  validatedIds,
  userId,
  file,
) {
  let storageMetadata = null

  try {
    storageMetadata =
      await privateRecordingStorage
        .saveBuffer({
          memoryId:
            validatedIds.memoryId,
          recordingId:
            recording._id.toString(),
          mimeType: file.mimetype,
          buffer: file.buffer,
        })

    const storedRecording =
      await MemoryRecording
        .findOneAndUpdate(
          {
            _id: recording._id,
            memoryId:
              validatedIds.memoryId,
            uploadedByUserId: userId,
            lifecycleStatus: 'active',
            storageStatus:
              recording.storageStatus,
          },
          {
            $set: {
              storageStatus: 'stored',
              storageProvider:
                storageMetadata
                  .storageProvider,
              storageKey:
                storageMetadata
                  .storageKey,
              sizeBytes:
                storageMetadata
                  .sizeBytes,
              checksumSha256:
                storageMetadata
                  .checksumSha256,
            },
            $unset: {
              storageFailureCode: 1,
            },
          },
          {
            returnDocument: 'after',
            runValidators: true,
          },
        )

    if (!storedRecording) {
      throw createUploadUnavailableError()
    }

    return storedRecording
  } catch (error) {
    if (storageMetadata) {
      await removeStoredFile(
        storageMetadata.storageKey,
      )
    }

    await markUploadFailed(
      recording,
      error,
    )

    throw error
  }
}

export async function storeMemoryRecordingFile(
  userId,
  memoryId,
  recordingId,
  file,
) {
  const uploadBuffer =
    file?.buffer

  try {
    validateUserId(userId)
    validateUploadFile(file)

    const validatedIds =
      memoryRecordingParamsSchema.parse({
        memoryId,
        recordingId,
      })

    await requireMemoryPermission(
      userId,
      validatedIds.memoryId,
      MEMORY_PERMISSIONS.CONTRIBUTE,
    )

    const recording =
      await MemoryRecording.findOne({
        _id: validatedIds.recordingId,
        memoryId:
          validatedIds.memoryId,
        uploadedByUserId: userId,
        lifecycleStatus: 'active',
      })

    if (!recording) {
      throw createRecordingNotFoundError()
    }

    if (
      !uploadableStorageStatuses
        .includes(
          recording.storageStatus,
        )
    ) {
      throw createUploadUnavailableError()
    }

    validateFileMatchesRecording(
      recording,
      file,
    )

    const storedRecording =
      await persistRecordingFile(
        recording,
        validatedIds,
        userId,
        file,
      )

    try {
      await completeInterviewSession({
        sessionId:
          storedRecording
            .interviewContext
            ?.sessionId,
        memoryId:
          validatedIds.memoryId,
        userId,
      })
    } catch {
      // The recording is already stored safely;
      // session reconciliation can retry later.
    }

    return storedRecording.toJSON()
  } finally {
    if (Buffer.isBuffer(uploadBuffer)) {
      uploadBuffer.fill(0)
    }
  }
}