import { storeMemoryRecordingFile } from './recordingFileService.js'

export async function uploadRecordingFile(
  req,
  res,
) {
  const recording =
    await storeMemoryRecordingFile(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedParams.recordingId,
      req.file,
    )

  res.status(200).json({
    success: true,
    data: {
      recording,
    },
  })
}