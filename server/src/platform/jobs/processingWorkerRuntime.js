import {
  MEMORY_ASSET_PARSE_JOB_TYPE,
  memoryAssetProcessingHandler,
} from '../../modules/media/memoryAssetProcessingService.js'
import {
  RECORDING_TRANSCRIPTION_JOB_TYPE,
  recordingTranscriptionProcessingHandler,
} from '../../modules/media/recordingTranscriptionQueueService.js'
import { createProcessingWorker } from './processingWorker.js'

const processingWorker =
  createProcessingWorker({
    handlers: {
      [MEMORY_ASSET_PARSE_JOB_TYPE]:
        memoryAssetProcessingHandler,
      [RECORDING_TRANSCRIPTION_JOB_TYPE]:
        recordingTranscriptionProcessingHandler,
    },
  })

export function startProcessingWorker() {
  processingWorker.start()
}

export function stopProcessingWorker() {
  return processingWorker.stop()
}
