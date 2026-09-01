import { AppError } from '../../errors/AppError.js'
import {
  MEMORY_PERMISSIONS,
  requireMemoryPermission,
} from '../memories/memoryAccessService.js'
import {
  getFamilyQuestionAnswerPrompt,
} from '../memories/familyQuestionService.js'
import {
  discardInterviewSession,
  startInterviewSession,
} from '../memories/interviewSessionService.js'
import MemoryRecording, {
  RECORDING_CONSENT_VERSION,
} from './MemoryRecording.js'
import {
  createMemoryRecordingSchema,
  memoryRecordingMemoryParamsSchema,
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

function validateMemoryId(memoryId) {
  return memoryRecordingMemoryParamsSchema
    .parse({
      memoryId,
    })
    .memoryId
}

function validateRecordingIds(
  memoryId,
  recordingId,
) {
  return memoryRecordingParamsSchema.parse({
    memoryId,
    recordingId,
  })
}

export async function createMemoryRecordingMetadata(
  userId,
  memoryId,
  input,
) {
  validateUserId(userId)

  const validatedMemoryId =
    validateMemoryId(memoryId)

  const recordingData =
    createMemoryRecordingSchema.parse(
      input,
    )

  const access =
    await requireMemoryPermission(
      userId,
      validatedMemoryId,
      MEMORY_PERMISSIONS.CONTRIBUTE,
    )

  const memoryProfile =
    access?.memoryProfile ?? {}

  const recordingInput = {
    memoryId: validatedMemoryId,
    uploadedByUserId: userId,
    displayName:
      recordingData.displayName,
    originalFileName:
      recordingData.originalFileName,
    mimeType: recordingData.mimeType,
    sizeBytes: recordingData.sizeBytes,
    languageCode:
      recordingData.languageCode,
    consent: {
      basis:
        recordingData.consent.basis,
      permittedUses:
        recordingData.consent
          .permittedUses,
      confirmedByUserId: userId,
      confirmedAt: new Date(),
      statementVersion:
        RECORDING_CONSENT_VERSION,
    },
  }

  if (recordingData.checksumSha256) {
    recordingInput.checksumSha256 =
      recordingData.checksumSha256
  }

  if (recordingData.durationMs) {
    recordingInput.durationMs =
      recordingData.durationMs
  }

  let interviewSession = null

  if (recordingData.interviewPrompt) {
    const interview =
      await startInterviewSession({
        userId,
        memoryId: validatedMemoryId,
        questionKey:
          recordingData.interviewPrompt
            .questionKey,
        subject: {
          subjectName:
            memoryProfile.subjectName,
          subjectGender:
            memoryProfile.subjectGender,
        },
      })

    interviewSession = interview.session
    recordingInput.interviewContext = {
      sessionId: interview.session._id,
      promptKey:
        interview.promptSnapshot.key,
      promptCategory:
        interview.promptSnapshot.category,
      promptText:
        interview.promptSnapshot.question,
    }
  } else if (
    recordingData.familyQuestionId
  ) {
    const familyQuestion =
      await getFamilyQuestionAnswerPrompt(
        validatedMemoryId,
        recordingData.familyQuestionId,
      )

    recordingInput.familyQuestionContext = {
      questionId:
        familyQuestion.questionId,
      questionText:
        familyQuestion.questionText,
    }
  }

  let recording

  try {
    recording =
      await MemoryRecording.create(
        recordingInput,
      )
  } catch (error) {
    if (interviewSession) {
      try {
        await discardInterviewSession(
          interviewSession._id,
        )
      } catch {
        // Preserve the original recording error.
      }
    }

    throw error
  }

  return recording.toJSON()
}

export async function listMemoryRecordings(
  userId,
  memoryId,
) {
  validateUserId(userId)

  const validatedMemoryId =
    validateMemoryId(memoryId)

  await requireMemoryPermission(
    userId,
    validatedMemoryId,
    MEMORY_PERMISSIONS.VIEW,
  )

  const recordings =
    await MemoryRecording.find({
      memoryId: validatedMemoryId,
      lifecycleStatus: 'active',
    }).sort({
      createdAt: -1,
      _id: -1,
    })

  return recordings.map((recording) =>
    recording.toJSON(),
  )
}

export async function getMemoryRecording(
  userId,
  memoryId,
  recordingId,
) {
  validateUserId(userId)

  const validatedIds =
    validateRecordingIds(
      memoryId,
      recordingId,
    )

  await requireMemoryPermission(
    userId,
    validatedIds.memoryId,
    MEMORY_PERMISSIONS.VIEW,
  )

  const recording =
    await MemoryRecording.findOne({
      _id: validatedIds.recordingId,
      memoryId:
        validatedIds.memoryId,
      lifecycleStatus: 'active',
    })

  if (!recording) {
    throw createRecordingNotFoundError()
  }

  return recording.toJSON()
}