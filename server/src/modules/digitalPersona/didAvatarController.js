import {
  generateMemoryChatAvatarSpeech,
  generateMemoryChatRealtimeAvatarSpeech,
  generateMemoryChatRealtimeAvatarSpeechChunk,
  readMemoryChatAvatarJob,
  readMemoryChatAvatarVideo,
  releaseMemoryChatRealtimeAvatarAudio,
} from './didAvatarService.js'

export async function generateChatAvatarSpeech(
  req,
  res,
) {
  const result =
    await generateMemoryChatAvatarSpeech(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedParams
        .conversationId,
      req.validatedParams.messageId,
    )

  const { speech } = result

  res
    .status(200)
    .set({
      'Content-Type': speech.contentType,
      'Content-Length': String(
        speech.byteLength,
      ),
      'Content-Disposition':
        `inline; filename="memory-avatar-response.${speech.fileExtension}"`,
      'Cache-Control':
        'private, no-store, max-age=0',
      'X-Content-Type-Options':
        'nosniff',
      'X-AI-Generated-Audio': 'true',
      'X-AI-Voice-Type':
        speech.voiceType ??
        'general_synthetic',
      'X-Avatar-Provider': 'd-id',
      'X-Avatar-Job-Id': result.jobId,
    })
    .send(speech.audioBuffer)
}

export async function generateChatRealtimeAvatarSpeech(
  req,
  res,
) {
  const result =
    await generateMemoryChatRealtimeAvatarSpeech(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedParams
        .conversationId,
      req.validatedParams.messageId,
    )

  const { speech } = result

  res
    .status(200)
    .set({
      'Content-Type': speech.contentType,
      'Content-Length': String(
        speech.byteLength,
      ),
      'Content-Disposition':
        `inline; filename="memory-realtime-avatar-response.${speech.fileExtension}"`,
      'Cache-Control':
        'private, no-store, max-age=0',
      'X-Content-Type-Options':
        'nosniff',
      'X-AI-Generated-Audio': 'true',
      'X-AI-Voice-Type':
        speech.voiceType ??
        'general_synthetic',
      'X-Avatar-Provider': 'd-id',
      'X-DID-Realtime-Audio-Url':
        result.audioUrl,
      'X-DID-Realtime-Release-Token':
        result.releaseToken,
    })
    .send(speech.audioBuffer)
}

export async function generateChatRealtimeAvatarSpeechChunk(
  req,
  res,
) {
  const result =
    await generateMemoryChatRealtimeAvatarSpeechChunk(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedParams
        .conversationId,
      req.validatedParams.messageId,
      req.validatedParams.chunkIndex,
    )

  const { speech } = result

  res
    .status(200)
    .set({
      'Content-Type': speech.contentType,
      'Content-Length': String(
        speech.byteLength,
      ),
      'Content-Disposition':
        `inline; filename="memory-realtime-avatar-chunk-${result.chunkIndex}.${speech.fileExtension}"`,
      'Cache-Control':
        'private, no-store, max-age=0',
      'X-Content-Type-Options':
        'nosniff',
      'X-AI-Generated-Audio': 'true',
      'X-AI-Voice-Type':
        speech.voiceType ??
        'general_synthetic',
      'X-Avatar-Provider': 'd-id',
      'X-DID-Realtime-Audio-Url':
        result.audioUrl,
      'X-DID-Realtime-Release-Token':
        result.releaseToken,
      'X-DID-Realtime-Chunk-Index':
        String(result.chunkIndex),
      'X-DID-Realtime-Chunk-Count':
        String(result.chunkCount),
    })
    .send(speech.audioBuffer)
}

export async function releaseChatRealtimeAvatarAudio(
  req,
  res,
) {
  await releaseMemoryChatRealtimeAvatarAudio(
    req.auth.userId,
    req.validatedParams.memoryId,
    req.validatedParams
      .realtimeAudioToken,
  )

  res.status(204).send()
}

export function getChatAvatarJob(
  req,
  res,
) {
  const job = readMemoryChatAvatarJob(
    req.auth.userId,
    req.validatedParams.memoryId,
    req.validatedParams.avatarJobId,
  )

  res.status(200).json({
    success: true,
    data: {
      avatarJob: job,
    },
  })
}

export function getChatAvatarVideo(
  req,
  res,
) {
  const video =
    readMemoryChatAvatarVideo(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedParams.avatarJobId,
    )

  res
    .status(200)
    .set({
      'Content-Type': video.contentType,
      'Content-Length': String(
        video.byteLength,
      ),
      'Content-Disposition':
        'inline; filename="living-memory-avatar.mp4"',
      'Cache-Control':
        'private, no-store, max-age=0',
      'X-Content-Type-Options':
        'nosniff',
      'X-AI-Generated-Video': 'true',
      'X-Avatar-Provider': 'd-id',
    })
    .send(video.videoBuffer)
}
