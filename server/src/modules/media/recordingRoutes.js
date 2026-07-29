import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { validateBody } from '../../middleware/validateBody.js'
import { validateParams } from '../../middleware/validateParams.js'
import {
  createRecording,
  getRecording,
  listRecordings,
} from './recordingController.js'
import {
  createMemoryRecordingSchema,
  memoryRecordingMemoryParamsSchema,
  memoryRecordingParamsSchema,
} from './recordingValidation.js'
import {
  requestRecordingTranscription,
} from './recordingTranscriptionController.js'
import {
  approveRecordingTranscript,
  getRecordingTranscript,
  updateRecordingTranscript,
} from './recordingTranscriptManagementController.js'
import {
  approveMemoryRecordingTranscriptSchema,
  memoryRecordingTranscriptionParamsSchema,
  requestMemoryRecordingTranscriptionSchema,
  updateMemoryRecordingTranscriptSchema,
} from './transcriptionValidation.js'
import {
  uploadRecording,
} from './recordingUpload.js'
import {
  requireRecordingUploadAccess,
} from './recordingUploadAccess.js'
import {
  uploadRecordingFile,
} from './recordingUploadController.js'

const recordingRoutes = Router({
  mergeParams: true,
})

recordingRoutes.use(requireAuth)

recordingRoutes.get(
  '/',
  validateParams(
    memoryRecordingMemoryParamsSchema,
  ),
  listRecordings,
)

recordingRoutes.post(
  '/',
  validateParams(
    memoryRecordingMemoryParamsSchema,
  ),
  validateBody(
    createMemoryRecordingSchema,
  ),
  createRecording,
)

recordingRoutes.put(
  '/:recordingId/file',
  validateParams(
    memoryRecordingParamsSchema,
  ),
  requireRecordingUploadAccess,
  uploadRecording,
  uploadRecordingFile,
)

recordingRoutes.post(
  '/:recordingId/transcription',
  validateParams(
    memoryRecordingTranscriptionParamsSchema,
  ),
  validateBody(
    requestMemoryRecordingTranscriptionSchema,
  ),
  requestRecordingTranscription,
)

recordingRoutes.get(
  '/:recordingId/transcript',
  validateParams(
    memoryRecordingTranscriptionParamsSchema,
  ),
  getRecordingTranscript,
)

recordingRoutes.patch(
  '/:recordingId/transcript',
  validateParams(
    memoryRecordingTranscriptionParamsSchema,
  ),
  validateBody(
    updateMemoryRecordingTranscriptSchema,
  ),
  updateRecordingTranscript,
)

recordingRoutes.post(
  '/:recordingId/transcript/approval',
  validateParams(
    memoryRecordingTranscriptionParamsSchema,
  ),
  validateBody(
    approveMemoryRecordingTranscriptSchema,
  ),
  approveRecordingTranscript,
)

recordingRoutes.get(
  '/:recordingId',
  validateParams(
    memoryRecordingParamsSchema,
  ),
  getRecording,
)

export default recordingRoutes