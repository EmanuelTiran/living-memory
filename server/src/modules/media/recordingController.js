import {
    createMemoryRecordingMetadata,
    getMemoryRecording,
    listMemoryRecordings,
  } from './recordingService.js'

  export async function createRecording(
    req,
    res,
  ) {
    const recording =
      await createMemoryRecordingMetadata(
        req.auth.userId,
        req.validatedParams.memoryId,
        req.validatedBody,
      )

    res.status(201).json({
      success: true,
      data: {
        recording,
      },
    })
  }

  export async function listRecordings(
    req,
    res,
  ) {
    const recordings =
      await listMemoryRecordings(
        req.auth.userId,
        req.validatedParams.memoryId,
      )

    res.status(200).json({
      success: true,
      data: {
        recordings,
      },
    })
  }

  export async function getRecording(
    req,
    res,
  ) {
    const recording =
      await getMemoryRecording(
        req.auth.userId,
        req.validatedParams.memoryId,
        req.validatedParams.recordingId,
      )

    res.status(200).json({
      success: true,
      data: {
        recording,
      },
    })
  }
