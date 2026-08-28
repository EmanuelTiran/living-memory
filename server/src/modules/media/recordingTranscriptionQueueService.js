import { env } from '../../config/env.js'
import { AppError } from '../../errors/AppError.js'
import {
  enqueueProcessingJob,
  getProcessingJobId,
} from '../../platform/jobs/processingJobService.js'
import {
  MEMORY_PERMISSIONS,
  requireMemoryPermission,
} from '../memories/memoryAccessService.js'
import MemoryRecording from './MemoryRecording.js'
import MemoryRecordingTranscript from './MemoryRecordingTranscript.js'
import {
  privateRecordingStorage,
} from './privateRecordingStorage.js'
import {
  transcribeMemoryRecording,
} from './recordingTranscriptionService.js'
import {
  memoryRecordingTranscriptionParamsSchema,
  requestMemoryRecordingTranscriptionSchema,
} from './transcriptionValidation.js'

export const RECORDING_TRANSCRIPTION_JOB_TYPE =
  'recording_transcription'

const queueableStatuses =
  Object.freeze([
    'not_requested',
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

function createTranscriptionConsentError() {
  return new AppError(
    'Transcription consent was not granted for this recording.',
    {
      statusCode: 409,
      code:
        'RECORDING_TRANSCRIPTION_NOT_CONSENTED',
    },
  )
}

function createRecordingFileUnavailableError() {
  return new AppError(
    'Recording file is not available for transcription.',
    {
      statusCode: 409,
      code:
        'RECORDING_FILE_UNAVAILABLE',
    },
  )
}

function createTranscriptionInProgressError() {
  return new AppError(
    'Recording transcription is already in progress.',
    {
      statusCode: 409,
      code:
        'RECORDING_TRANSCRIPTION_IN_PROGRESS',
    },
  )
}

function createTranscriptUnavailableError() {
  return new AppError(
    'Recording transcript is not available.',
    {
      statusCode: 409,
      code:
        'RECORDING_TRANSCRIPT_UNAVAILABLE',
    },
  )
}

function createTranscriptionStateError() {
  return new AppError(
    'Recording transcription state changed before the operation completed.',
    {
      statusCode: 409,
      code:
        'RECORDING_TRANSCRIPTION_STATE_CHANGED',
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

function hasTranscriptionConsent(
  recording,
) {
  return (
    Array.isArray(
      recording?.consent?.permittedUses,
    ) &&
    recording.consent.permittedUses
      .includes('transcription')
  )
}

function validateStoredRecording(
  recording,
) {
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

  return 'RECORDING_TRANSCRIPTION_FAILED'
}

async function findStoredRecording(
  memoryId,
  recordingId,
) {
  return MemoryRecording
    .findOne({
      _id: recordingId,
      memoryId,
      lifecycleStatus: 'active',
    })
    .select(
      '+storageKey +checksumSha256 +transcriptionFailureCode +transcriptionJobId +transcriptionRequestSequence',
    )
}

async function findExistingTranscript(
  memoryId,
  recordingId,
) {
  return MemoryRecordingTranscript
    .findOne({
      memoryId,
      recordingId,
      lifecycleStatus: 'active',
    })
}

async function finalizeFromExistingTranscript(
  recording,
  transcript,
) {
  if (
    recording.transcriptionStatus ===
      'completed'
  ) {
    return
  }

  const completedRecording =
    await MemoryRecording
      .findOneAndUpdate(
        {
          _id: recording._id,
          memoryId:
            recording.memoryId,
          lifecycleStatus: 'active',
        },
        {
          $set: {
            transcriptionStatus:
              'completed',
            transcriptionProgress: 100,
            transcriptionProvider:
              transcript
                .transcriptionProvider,
            transcriptionModel:
              transcript
                .transcriptionModel,
            transcriptionCompletedAt:
              transcript.generatedAt ??
              new Date(),
          },
          $unset: {
            transcriptionFailureCode: 1,
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        },
      )

  if (!completedRecording) {
    throw createTranscriptionStateError()
  }
}

export async function enqueueMemoryRecordingTranscription(
  userId,
  memoryId,
  recordingId,
  input = {},
) {
  validateUserId(userId)

  const validatedIds =
    memoryRecordingTranscriptionParamsSchema
      .parse({
        memoryId,
        recordingId,
      })

  const validatedInput =
    requestMemoryRecordingTranscriptionSchema
      .parse(input)

  await requireMemoryPermission(
    userId,
    validatedIds.memoryId,
    MEMORY_PERMISSIONS.CONTRIBUTE,
  )

  const recording =
    await findStoredRecording(
      validatedIds.memoryId,
      validatedIds.recordingId,
    )

  if (!recording) {
    throw createRecordingNotFoundError()
  }

  if (!hasTranscriptionConsent(recording)) {
    throw createTranscriptionConsentError()
  }

  validateStoredRecording(recording)

  const existingTranscript =
    await findExistingTranscript(
      validatedIds.memoryId,
      validatedIds.recordingId,
    )

  if (existingTranscript) {
    await finalizeFromExistingTranscript(
      recording,
      existingTranscript,
    )

    return {
      transcript:
        existingTranscript.toJSON(),
      created: false,
      queued: false,
      jobId: null,
    }
  }

  if (
    recording.transcriptionStatus ===
      'completed'
  ) {
    throw createTranscriptUnavailableError()
  }

  if (
    ['queued', 'processing'].includes(
      recording.transcriptionStatus,
    )
  ) {
    return {
      transcript: null,
      created: false,
      queued: true,
      jobId:
        recording.transcriptionJobId
          ?.toString?.() ?? null,
    }
  }

  if (
    !queueableStatuses.includes(
      recording.transcriptionStatus,
    )
  ) {
    throw createTranscriptionInProgressError()
  }

  const queuedRecording =
    await MemoryRecording
      .findOneAndUpdate(
        {
          _id: recording._id,
          memoryId:
            recording.memoryId,
          lifecycleStatus: 'active',
          storageStatus: 'stored',
          transcriptionStatus:
            recording.transcriptionStatus,
        },
        {
          $set: {
            transcriptionStatus:
              'queued',
            transcriptionProgress: 0,
            transcriptionProvider:
              'openai',
            transcriptionModel:
              env.openaiTranscriptionModel,
          },
          $inc: {
            transcriptionRequestSequence: 1,
          },
          $unset: {
            transcriptionCompletedAt: 1,
            transcriptionFailureCode: 1,
            transcriptionJobId: 1,
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        },
      )
      .select(
        '+transcriptionRequestSequence',
      )

  if (!queuedRecording) {
    throw createTranscriptionInProgressError()
  }

  let job

  try {
    job = await enqueueProcessingJob({
      memoryId:
        validatedIds.memoryId,
      jobType:
        RECORDING_TRANSCRIPTION_JOB_TYPE,
      idempotencyKey:
        `recording-transcription:${validatedIds.recordingId}:${queuedRecording.transcriptionRequestSequence}`,
      resourceType:
        'memory_recording',
      resourceId:
        validatedIds.recordingId,
      payload: {
        memoryId:
          validatedIds.memoryId,
        recordingId:
          validatedIds.recordingId,
        requestedByUserId: userId,
        languageCode:
          validatedInput.languageCode ??
          recording.languageCode,
      },
      maxAttempts: 3,
      availableAt: new Date(
        Date.now() + 500,
      ),
    })
  } catch (error) {
    await MemoryRecording.updateOne(
      {
        _id: recording._id,
        memoryId:
          recording.memoryId,
        transcriptionStatus:
          'queued',
      },
      {
        $set: {
          transcriptionStatus:
            'failed',
          transcriptionProgress: 0,
          transcriptionFailureCode:
            resolveFailureCode(error),
        },
      },
      {
        runValidators: true,
      },
    )

    throw error
  }

  const jobId = getProcessingJobId(job)
  const linkedRecording =
    await MemoryRecording.updateOne(
      {
        _id: recording._id,
        memoryId:
          recording.memoryId,
        lifecycleStatus: 'active',
        transcriptionStatus:
          'queued',
        transcriptionRequestSequence:
          queuedRecording
            .transcriptionRequestSequence,
      },
      {
        $set: {
          transcriptionJobId: jobId,
        },
      },
      {
        runValidators: true,
      },
    )

  if (linkedRecording.matchedCount !== 1) {
    throw createTranscriptionStateError()
  }

  return {
    transcript: null,
    created: false,
    queued: true,
    jobId,
  }
}

async function processQueuedTranscription({
  job,
  updateProgress,
}) {
  const jobId = getProcessingJobId(job)

  const ownedRecording =
    await MemoryRecording.updateOne(
      {
        _id: job.payload.recordingId,
        memoryId:
          job.payload.memoryId,
        lifecycleStatus: 'active',
        transcriptionStatus: {
          $in: [
            'queued',
            'processing',
          ],
        },
        $or: [
          {
            transcriptionJobId:
              jobId,
          },
          {
            transcriptionJobId: null,
          },
          {
            transcriptionJobId: {
              $exists: false,
            },
          },
        ],
      },
      {
        $set: {
          transcriptionJobId: jobId,
          transcriptionStatus:
            'queued',
        },
      },
      {
        runValidators: true,
      },
    )

  if (ownedRecording.matchedCount !== 1) {
    throw createTranscriptionStateError()
  }

  async function reportProgress(progress) {
    await updateProgress(progress)

    await MemoryRecording.updateOne(
      {
        _id: job.payload.recordingId,
        memoryId:
          job.payload.memoryId,
        transcriptionJobId: jobId,
        lifecycleStatus: 'active',
      },
      {
        $max: {
          transcriptionProgress:
            progress,
        },
      },
      {
        runValidators: true,
      },
    )
  }

  const result =
    await transcribeMemoryRecording(
      job.payload.requestedByUserId,
      job.payload.memoryId,
      job.payload.recordingId,
      {
        languageCode:
          job.payload.languageCode,
      },
      {
        fromQueue: true,
        jobId,
        updateProgress:
          reportProgress,
        deferFailureState: true,
      },
    )

  return {
    transcriptId:
      result.transcript.id,
    created: result.created,
    reviewStatus:
      result.transcript.reviewStatus,
  }
}

async function handleQueuedTranscriptionFailure({
  job,
  settledJob,
}) {
  const isTerminal =
    settledJob.status === 'failed'

  await MemoryRecording.updateOne(
    {
      _id: job.payload.recordingId,
      memoryId:
        job.payload.memoryId,
      transcriptionJobId:
        getProcessingJobId(job),
      lifecycleStatus: 'active',
    },
    isTerminal
      ? {
          $set: {
            transcriptionStatus:
              'failed',
            transcriptionProgress: 0,
            transcriptionFailureCode:
              settledJob.lastErrorCode ??
              'RECORDING_TRANSCRIPTION_FAILED',
          },
          $unset: {
            transcriptionCompletedAt: 1,
          },
        }
      : {
          $set: {
            transcriptionStatus:
              'queued',
            transcriptionProgress: 0,
          },
          $unset: {
            transcriptionFailureCode: 1,
            transcriptionCompletedAt: 1,
          },
        },
    {
      runValidators: true,
    },
  )
}

export const recordingTranscriptionProcessingHandler =
  Object.freeze({
    run: processQueuedTranscription,
    onFailure:
      handleQueuedTranscriptionFailure,
  })
