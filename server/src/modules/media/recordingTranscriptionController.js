import {
    transcribeMemoryRecording,
  } from './recordingTranscriptionService.js'

  export async function requestRecordingTranscription(
    req,
    res,
  ) {
    const result =
      await transcribeMemoryRecording(
        req.auth.userId,
        req.validatedParams.memoryId,
        req.validatedParams.recordingId,
        req.validatedBody,
      )

    res
      .status(
        result.created ? 201 : 200,
      )
      .json({
        success: true,
        data: {
          transcript:
            result.transcript,
          created:
            result.created,
        },
      })
  }
