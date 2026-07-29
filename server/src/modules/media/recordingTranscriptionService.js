import {
    createHash,
  } from 'node:crypto'
  import { env } from '../../config/env.js'
  import { AppError } from '../../errors/AppError.js'
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
    transcribeRecordingWithOpenAI,
  } from './openaiTranscriptionProvider.js'
  import {
    memoryRecordingTranscriptionParamsSchema,
    requestMemoryRecordingTranscriptionSchema,
  } from './transcriptionValidation.js'

  const processableTranscriptionStatuses =
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

  function createBufferChecksum(buffer) {
    return createHash('sha256')
      .update(buffer)
      .digest('hex')
  }

  function verifyRecordingIntegrity(
    recording,
    audioBuffer,
  ) {
    if (
      !Buffer.isBuffer(audioBuffer) ||
      audioBuffer.length !==
        recording.sizeBytes ||
      createBufferChecksum(audioBuffer) !==
        recording.checksumSha256
    ) {
      throw createRecordingIntegrityError()
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
        '+storageKey +checksumSha256 +transcriptionFailureCode',
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

  async function startTranscription(
    recording,
  ) {
    const startedRecording =
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
                'processing',
              transcriptionProvider:
                'openai',
              transcriptionModel:
                env.openaiTranscriptionModel,
            },
            $unset: {
              transcriptionCompletedAt: 1,
              transcriptionFailureCode: 1,
            },
          },
          {
            returnDocument: 'after',
            runValidators: true,
          },
        )

    if (!startedRecording) {
      throw createTranscriptionInProgressError()
    }
  }

  async function completeTranscription(
    recording,
    transcription,
    generatedAt,
  ) {
    const completedRecording =
      await MemoryRecording
        .findOneAndUpdate(
          {
            _id: recording._id,
            memoryId:
              recording.memoryId,
            lifecycleStatus: 'active',
            transcriptionStatus:
              'processing',
          },
          {
            $set: {
              transcriptionStatus:
                'completed',
              transcriptionProvider:
                transcription.provider,
              transcriptionModel:
                transcription.model,
              transcriptionCompletedAt:
                generatedAt,
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

  async function markTranscriptionFailed(
    recording,
    error,
  ) {
    try {
      await MemoryRecording
        .findOneAndUpdate(
          {
            _id: recording._id,
            memoryId:
              recording.memoryId,
            lifecycleStatus: 'active',
            transcriptionStatus:
              'processing',
          },
          {
            $set: {
              transcriptionStatus:
                'failed',
              transcriptionFailureCode:
                resolveFailureCode(error),
            },
            $unset: {
              transcriptionCompletedAt: 1,
            },
          },
          {
            returnDocument: 'after',
            runValidators: true,
          },
        )
    } catch {
      // Preserve the original transcription error.
    }
  }

  async function saveTranscriptDraft({
    recording,
    userId,
    transcription,
    generatedAt,
  }) {
    return MemoryRecordingTranscript
      .create({
        memoryId: recording.memoryId,
        recordingId: recording._id,
        requestedByUserId: userId,
        content:
          transcription.content,
        languageCode:
          transcription.languageCode,
        transcriptionProvider:
          transcription.provider,
        transcriptionModel:
          transcription.model,
        providerResponseId:
          transcription
            .providerResponseId,
        recordingChecksumSha256:
          recording.checksumSha256,
        generatedAt,
        reviewStatus: 'draft',
        revision: 1,
        lifecycleStatus: 'active',
      })
  }

  export async function transcribeMemoryRecording(
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

    if (
      !hasTranscriptionConsent(
        recording,
      )
    ) {
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
      }
    }

    if (
      recording.transcriptionStatus ===
      'completed'
    ) {
      throw createTranscriptUnavailableError()
    }

    if (
      !processableTranscriptionStatuses
        .includes(
          recording.transcriptionStatus,
        )
    ) {
      throw createTranscriptionInProgressError()
    }

    let processingStarted = false
    let audioBuffer = null

    try {
      await startTranscription(
        recording,
      )

      processingStarted = true

      audioBuffer =
        await privateRecordingStorage
          .readBuffer(
            recording.storageKey,
          )

      verifyRecordingIntegrity(
        recording,
        audioBuffer,
      )

      const transcription =
        await transcribeRecordingWithOpenAI({
          audioBuffer,
          originalFileName:
            recording.originalFileName,
          mimeType:
            recording.mimeType,
          languageCode:
            validatedInput
              .languageCode ??
            recording.languageCode,
        })

      const generatedAt = new Date()

      const transcript =
        await saveTranscriptDraft({
          recording,
          userId,
          transcription,
          generatedAt,
        })

      await completeTranscription(
        recording,
        transcription,
        generatedAt,
      )

      return {
        transcript:
          transcript.toJSON(),
        created: true,
      }
    } catch (error) {
      if (processingStarted) {
        await markTranscriptionFailed(
          recording,
          error,
        )
      }

      throw error
    } finally {
      if (
        Buffer.isBuffer(audioBuffer)
      ) {
        audioBuffer.fill(0)
      }
    }
  }
