import {
    generateMemoryChatMessageSpeech,
  } from './speechService.js'

  export async function generateChatMessageSpeech(
    req,
    res,
  ) {
    const speech =
      await generateMemoryChatMessageSpeech(
        req.auth.userId,
        req.validatedParams.memoryId,
        req.validatedParams
          .conversationId,
        req.validatedParams.messageId,
      )

    res
      .status(200)
      .set({
        'Content-Type':
          speech.contentType,
        'Content-Length':
          String(speech.byteLength),
        'Content-Disposition':
          'inline; filename="memory-response.mp3"',
        'Cache-Control':
          'private, no-store, max-age=0',
        'X-Content-Type-Options':
          'nosniff',
        'X-AI-Generated-Audio':
          'true',
      })
      .send(speech.audioBuffer)
  }
