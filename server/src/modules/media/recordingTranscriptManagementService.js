import { AppError } from '../../errors/AppError.js'
import {
  MEMORY_PERMISSIONS,
  requireMemoryPermission,
} from '../memories/memoryAccessService.js'
import {
  createTranscriptRevisionSnapshot,
  MAX_SOURCE_REVISION_HISTORY,
} from '../memories/sourceRevisionHistory.js'
import MemoryRecording from './MemoryRecording.js'
import MemoryRecordingTranscript from './MemoryRecordingTranscript.js'
import {
  approveMemoryRecordingTranscriptSchema,
  memoryRecordingTranscriptionParamsSchema,
  updateMemoryRecordingTranscriptSchema,
} from './transcriptionValidation.js'

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

function createTranscriptNotFoundError() {
  return new AppError(
    'Recording transcript was not found.',
    {
      statusCode: 404,
      code:
        'RECORDING_TRANSCRIPT_NOT_FOUND',
    },
  )
}

function createRecordingNotFoundError() {
  return new AppError(
    'Recording was not found.',
    {
      statusCode: 404,
      code: 'RECORDING_NOT_FOUND',
    },
  )
}

function createTranscriptApprovedError() {
  return new AppError(
    'An approved transcript cannot be edited.',
    {
      statusCode: 409,
      code:
        'RECORDING_TRANSCRIPT_ALREADY_APPROVED',
    },
  )
}

function createTranscriptNotApprovedError() {
  return new AppError(
    'Only an approved transcript can start a new revision.',
    {
      statusCode: 409,
      code:
        'RECORDING_TRANSCRIPT_NOT_APPROVED',
    },
  )
}

function createTranscriptConflictError() {
  return new AppError(
    'The transcript could not be changed because it was updated by another request.',
    {
      statusCode: 409,
      code:
        'RECORDING_TRANSCRIPT_CONFLICT',
    },
  )
}

function createGroundingConsentError() {
  return new AppError(
    'Using this transcript as a memory source was not authorized.',
    {
      statusCode: 409,
      code:
        'TRANSCRIPT_GROUNDING_NOT_CONSENTED',
    },
  )
}

function serializeTranscript(
  transcript,
) {
  return typeof transcript?.toJSON ===
    'function'
    ? transcript.toJSON()
    : {
        ...transcript,
      }
}

function hasMemoryGroundingConsent(
  recording,
) {
  return (
    Array.isArray(
      recording?.consent?.permittedUses,
    ) &&
    recording.consent.permittedUses
      .includes('memory_grounding')
  )
}

async function findActiveTranscript(
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

async function findActiveRecording(
  memoryId,
  recordingId,
) {
  return MemoryRecording.findOne({
    _id: recordingId,
    memoryId,
    lifecycleStatus: 'active',
  })
}

function validateRevision(
  transcript,
  expectedRevision,
) {
  if (
    transcript.revision !==
    expectedRevision
  ) {
    throw createTranscriptConflictError()
  }
}

export async function getMemoryRecordingTranscript(
  userId,
  memoryId,
  recordingId,
) {
  validateUserId(userId)

  const validatedParams =
    memoryRecordingTranscriptionParamsSchema
      .parse({
        memoryId,
        recordingId,
      })

  await requireMemoryPermission(
    userId,
    validatedParams.memoryId,
    MEMORY_PERMISSIONS.VIEW,
  )

  const transcript =
    await findActiveTranscript(
      validatedParams.memoryId,
      validatedParams.recordingId,
    )

  if (!transcript) {
    throw createTranscriptNotFoundError()
  }

  return serializeTranscript(
    transcript,
  )
}

export async function updateMemoryRecordingTranscript(
  userId,
  memoryId,
  recordingId,
  input,
) {
  validateUserId(userId)

  const validatedParams =
    memoryRecordingTranscriptionParamsSchema
      .parse({
        memoryId,
        recordingId,
      })

  const validatedInput =
    updateMemoryRecordingTranscriptSchema
      .parse(input)

  await requireMemoryPermission(
    userId,
    validatedParams.memoryId,
    MEMORY_PERMISSIONS.EDIT,
  )

  const transcript =
    await findActiveTranscript(
      validatedParams.memoryId,
      validatedParams.recordingId,
    )

  if (!transcript) {
    throw createTranscriptNotFoundError()
  }

  if (
    transcript.reviewStatus !==
    'draft'
  ) {
    throw createTranscriptApprovedError()
  }

  validateRevision(
    transcript,
    validatedInput.expectedRevision,
  )

  const updatedTranscript =
    await MemoryRecordingTranscript
      .findOneAndUpdate(
        {
          _id: transcript._id,
          memoryId:
            validatedParams.memoryId,
          recordingId:
            validatedParams.recordingId,
          lifecycleStatus: 'active',
          reviewStatus: 'draft',
          revision:
            validatedInput
              .expectedRevision,
        },
        {
          $set: {
            content:
              validatedInput.content,
            sourceIndexStatus:
              'not_indexed',
            sourceIndexedAt: null,
            sourceIndexRevision: null,
          },
          $inc: {
            revision: 1,
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        },
      )

  if (!updatedTranscript) {
    throw createTranscriptConflictError()
  }

  return serializeTranscript(
    updatedTranscript,
  )
}

export async function reviseApprovedMemoryRecordingTranscript(
  userId,
  memoryId,
  recordingId,
  input,
) {
  validateUserId(userId)

  const validatedParams =
    memoryRecordingTranscriptionParamsSchema
      .parse({
        memoryId,
        recordingId,
      })

  const validatedInput =
    updateMemoryRecordingTranscriptSchema
      .parse(input)

  await requireMemoryPermission(
    userId,
    validatedParams.memoryId,
    MEMORY_PERMISSIONS.EDIT,
  )

  const transcript =
    await findActiveTranscript(
      validatedParams.memoryId,
      validatedParams.recordingId,
    )

  if (!transcript) {
    throw createTranscriptNotFoundError()
  }

  if (
    transcript.reviewStatus !==
    'approved'
  ) {
    throw createTranscriptNotApprovedError()
  }

  validateRevision(
    transcript,
    validatedInput.expectedRevision,
  )

  const changedAt = new Date()
  const revisionSnapshot =
    createTranscriptRevisionSnapshot(
      transcript,
      userId,
      changedAt,
    )

  const revisedTranscript =
    await MemoryRecordingTranscript
      .findOneAndUpdate(
        {
          _id: transcript._id,
          memoryId:
            validatedParams.memoryId,
          recordingId:
            validatedParams.recordingId,
          lifecycleStatus: 'active',
          reviewStatus: 'approved',
          revision:
            validatedInput
              .expectedRevision,
        },
        {
          $set: {
            content:
              validatedInput.content,
            reviewStatus: 'draft',
            approvedAt: null,
            approvedByUserId: null,
            sourceIndexStatus:
              'not_indexed',
            sourceIndexedAt: null,
            sourceIndexRevision: null,
            lastEditedAt: changedAt,
            lastEditedByUserId:
              userId,
          },
          $inc: {
            revision: 1,
          },
          $push: {
            revisionHistory: {
              $each: [
                revisionSnapshot,
              ],
              $slice:
                -MAX_SOURCE_REVISION_HISTORY,
            },
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        },
      )

  if (!revisedTranscript) {
    throw createTranscriptConflictError()
  }

  return serializeTranscript(
    revisedTranscript,
  )
}

export async function approveMemoryRecordingTranscript(
  userId,
  memoryId,
  recordingId,
  input,
) {
  validateUserId(userId)

  const validatedParams =
    memoryRecordingTranscriptionParamsSchema
      .parse({
        memoryId,
        recordingId,
      })

  const validatedInput =
    approveMemoryRecordingTranscriptSchema
      .parse(input)

  await requireMemoryPermission(
    userId,
    validatedParams.memoryId,
    MEMORY_PERMISSIONS.EDIT,
  )

  const recording =
    await findActiveRecording(
      validatedParams.memoryId,
      validatedParams.recordingId,
    )

  if (!recording) {
    throw createRecordingNotFoundError()
  }

  if (
    !hasMemoryGroundingConsent(
      recording,
    )
  ) {
    throw createGroundingConsentError()
  }

  const transcript =
    await findActiveTranscript(
      validatedParams.memoryId,
      validatedParams.recordingId,
    )

  if (!transcript) {
    throw createTranscriptNotFoundError()
  }

  if (
    transcript.reviewStatus ===
    'approved'
  ) {
    if (
      transcript.sourceIndexStatus !==
        'indexed' ||
      transcript.sourceIndexRevision !==
        transcript.revision
    ) {
      const indexedAt = new Date()
      const indexedTranscript =
        await MemoryRecordingTranscript
          .findOneAndUpdate(
            {
              _id: transcript._id,
              memoryId:
                validatedParams.memoryId,
              recordingId:
                validatedParams.recordingId,
              lifecycleStatus: 'active',
              reviewStatus: 'approved',
              revision:
                transcript.revision,
            },
            {
              $set: {
                sourceIndexStatus:
                  'indexed',
                sourceIndexedAt:
                  indexedAt,
                sourceIndexRevision:
                  transcript.revision,
              },
            },
            {
              returnDocument: 'after',
              runValidators: true,
            },
          )

      if (!indexedTranscript) {
        throw createTranscriptConflictError()
      }

      return {
        transcript:
          serializeTranscript(
            indexedTranscript,
          ),
        approved: false,
      }
    }

    return {
      transcript:
        serializeTranscript(
          transcript,
        ),
      approved: false,
    }
  }

  validateRevision(
    transcript,
    validatedInput.expectedRevision,
  )

  const approvedAt = new Date()

  const approvedTranscript =
    await MemoryRecordingTranscript
      .findOneAndUpdate(
        {
          _id: transcript._id,
          memoryId:
            validatedParams.memoryId,
          recordingId:
            validatedParams.recordingId,
          lifecycleStatus: 'active',
          reviewStatus: 'draft',
          revision:
            validatedInput
              .expectedRevision,
        },
        {
          $set: {
            reviewStatus:
              'approved',
            approvedAt,
            approvedByUserId:
              userId,
            sourceIndexStatus:
              'indexed',
            sourceIndexedAt:
              approvedAt,
            sourceIndexRevision:
              transcript.revision,
          },
        },
        {
          returnDocument: 'after',
          runValidators: true,
        },
      )

  if (!approvedTranscript) {
    throw createTranscriptConflictError()
  }

  return {
    transcript:
      serializeTranscript(
        approvedTranscript,
      ),
    approved: true,
  }
}
