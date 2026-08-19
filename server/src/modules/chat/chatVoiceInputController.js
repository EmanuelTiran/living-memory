import {
  transcribeChatVoiceInput,
} from './chatVoiceInputService.js'
import {
  discardChatVoiceInput,
} from './chatVoiceInputUpload.js'

export async function transcribeVoiceInput(
  req,
  res,
) {
  try {
    const transcript =
      await transcribeChatVoiceInput(
        req.auth.userId,
        req.validatedParams.memoryId,
        req.file,
      )

    res.status(200).json({
      success: true,
      data: {
        transcript,
      },
    })
  } finally {
    discardChatVoiceInput(req)
  }
}
