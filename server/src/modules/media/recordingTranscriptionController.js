import {
    enqueueMemoryRecordingTranscription,
  } from './recordingTranscriptionQueueService.js'

  export async function requestRecordingTranscription(
    req,
    res,
  ) {
    const result =
      await enqueueMemoryRecordingTranscription(
        req.auth.userId,
        req.validatedParams.memoryId,
        req.validatedParams.recordingId,
        req.validatedBody,
      )

    res
      .status(
        result.queued ? 202 : 200,
      )
      .json({
        success: true,
        data: {
          transcript:
            result.transcript,
          created:
            result.created,
          queued:
            result.queued,
        },
      })
  }
