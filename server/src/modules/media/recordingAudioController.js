import {
  getMemoryRecordingAudio,
} from './recordingAudioService.js'

export async function streamRecordingAudio(
  req,
  res,
) {
  const audio =
    await getMemoryRecordingAudio(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedParams.recordingId,
    )

  res.set({
    'Cache-Control':
      'private, no-store, max-age=0',
    'Content-Length':
      String(audio.audioBuffer.length),
    'Content-Type': audio.mimeType,
    'X-Content-Type-Options':
      'nosniff',
  })

  res.status(200).send(
    audio.audioBuffer,
  )
}
