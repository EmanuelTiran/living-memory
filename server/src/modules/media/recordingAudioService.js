import {
  createHash,
} from 'node:crypto'
import { AppError } from '../../errors/AppError.js'
import {
  MEMORY_PERMISSIONS,
  requireMemoryPermission,
} from '../memories/memoryAccessService.js'
import MemoryRecording from './MemoryRecording.js'
import {
  privateRecordingStorage,
} from './privateRecordingStorage.js'
import {
  memoryRecordingParamsSchema,
} from './recordingValidation.js'

function createRecordingNotFoundError() {
  return new AppError(
    'Recording was not found.',
    {
      statusCode: 404,
      code: 'RECORDING_NOT_FOUND',
    },
  )
}

function createPlaybackConsentError() {
  return new AppError(
    'Playback was not authorized for this recording.',
    {
      statusCode: 403,
      code:
        'RECORDING_PLAYBACK_NOT_CONSENTED',
    },
  )
}

function createRecordingFileUnavailableError() {
  return new AppError(
    'Recording file is not available for playback.',
    {
      statusCode: 409,
      code:
        'RECORDING_FILE_UNAVAILABLE',
    },
  )
}

function createRecordingIntegrityError() {
  return new AppError(
    'Recording file integrity verification failed.',
    {
      statusCode: 409,
      code:
        'RECORDING_INTEGRITY_FAILED',
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

function hasPlaybackConsent(recording) {
  return Boolean(
    recording.consent?.permittedUses
      ?.includes('recording_playback'),
  )
}

function validateStoredRecording(recording) {
  if (
    recording.storageStatus !==
      'stored' ||
    recording.storageProvider !==
      privateRecordingStorage.provider ||
    typeof recording.storageKey !==
      'string' ||
    recording.storageKey.length === 0 ||
    typeof recording.checksumSha256 !==
      'string' ||
    !/^[a-f0-9]{64}$/.test(
      recording.checksumSha256,
    )
  ) {
    throw createRecordingFileUnavailableError()
  }
}

function verifyRecordingIntegrity(
  recording,
  audioBuffer,
) {
  const checksum = createHash('sha256')
    .update(audioBuffer)
    .digest('hex')

  if (
    audioBuffer.length !==
      recording.sizeBytes ||
    checksum !==
      recording.checksumSha256
  ) {
    throw createRecordingIntegrityError()
  }
}

export async function getMemoryRecordingAudio(
  userId,
  memoryId,
  recordingId,
) {
  validateUserId(userId)

  const validatedParams =
    memoryRecordingParamsSchema.parse({
      memoryId,
      recordingId,
    })

  await requireMemoryPermission(
    userId,
    validatedParams.memoryId,
    MEMORY_PERMISSIONS.VIEW,
  )

  const recording =
    await MemoryRecording.findOne({
      _id: validatedParams.recordingId,
      memoryId:
        validatedParams.memoryId,
      lifecycleStatus: 'active',
    }).select(
      '+storageKey +checksumSha256',
    )

  if (!recording) {
    throw createRecordingNotFoundError()
  }

  if (!hasPlaybackConsent(recording)) {
    throw createPlaybackConsentError()
  }

  validateStoredRecording(recording)

  const audioBuffer =
    await privateRecordingStorage
      .readBuffer(
        recording.storageKey,
      )

  verifyRecordingIntegrity(
    recording,
    audioBuffer,
  )

  return {
    audioBuffer,
    mimeType: recording.mimeType,
  }
}
