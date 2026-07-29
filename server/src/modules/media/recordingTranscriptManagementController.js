import {
    approveMemoryRecordingTranscript,
    getMemoryRecordingTranscript,
    updateMemoryRecordingTranscript,
  } from './recordingTranscriptManagementService.js'

  export async function getRecordingTranscript(
    req,
    res,
  ) {
    const transcript =
      await getMemoryRecordingTranscript(
        req.auth.userId,
        req.validatedParams.memoryId,
        req.validatedParams.recordingId,
      )

    res.status(200).json({
      success: true,
      data: {
        transcript,
      },
    })
  }

  export async function updateRecordingTranscript(
    req,
    res,
  ) {
    const transcript =
      await updateMemoryRecordingTranscript(
        req.auth.userId,
        req.validatedParams.memoryId,
        req.validatedParams.recordingId,
        req.validatedBody,
      )

    res.status(200).json({
      success: true,
      data: {
        transcript,
      },
    })
  }

  export async function approveRecordingTranscript(
    req,
    res,
  ) {
    const result =
      await approveMemoryRecordingTranscript(
        req.auth.userId,
        req.validatedParams.memoryId,
        req.validatedParams.recordingId,
        req.validatedBody,
      )

    res.status(200).json({
      success: true,
      data: {
        transcript:
          result.transcript,
        approved:
          result.approved,
      },
    })
  }
