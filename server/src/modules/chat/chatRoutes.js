import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { validateBody } from '../../middleware/validateBody.js'
import { validateParams } from '../../middleware/validateParams.js'
import { validateQuery } from '../../middleware/validateQuery.js'
import {
  createChatConversation,
  getChatHistory,
  sendChatMessage,
} from './chatController.js'
import {
  chatMessageRateLimiter,
} from './chatRateLimiter.js'
import {
  transcribeVoiceInput,
} from './chatVoiceInputController.js'
import {
  chatVoiceInputRateLimiter,
} from './chatVoiceInputRateLimiter.js'
import {
  uploadChatVoiceInput,
} from './chatVoiceInputUpload.js'
import {
  chatConversationParamsSchema,
  chatHistoryQuerySchema,
  chatMemoryParamsSchema,
  sendChatMessageSchema,
} from './validation.js'
import {
  generateChatMessageSpeech,
} from '../voice/speechController.js'
import {
  chatRealtimeSpeechChunkRateLimiter,
  chatSpeechRateLimiter,
} from '../voice/speechRateLimiter.js'
import {
  chatSpeechParamsSchema,
  avatarJobParamsSchema,
  realtimeAvatarSpeechChunkParamsSchema,
  realtimeAudioParamsSchema,
} from '../voice/speechValidation.js'
import {
  generateChatAvatarSpeech,
  generateChatRealtimeAvatarSpeech,
  generateChatRealtimeAvatarSpeechChunk,
  getChatAvatarJob,
  getChatAvatarVideo,
  releaseChatRealtimeAvatarAudio,
} from '../digitalPersona/didAvatarController.js'

const chatRoutes = Router({
  mergeParams: true,
})

chatRoutes.use(requireAuth)

chatRoutes.post(
  '/conversations',
  validateParams(chatMemoryParamsSchema),
  createChatConversation,
)

chatRoutes.post(
  '/voice-input/transcription',
  validateParams(chatMemoryParamsSchema),
  chatVoiceInputRateLimiter,
  uploadChatVoiceInput,
  transcribeVoiceInput,
)

chatRoutes.get(
  '/conversations/:conversationId/messages',
  validateParams(
    chatConversationParamsSchema,
  ),
  validateQuery(chatHistoryQuerySchema),
  getChatHistory,
)

chatRoutes.post(
  '/conversations/:conversationId/messages/:messageId/speech',
  validateParams(
    chatSpeechParamsSchema,
  ),
  chatSpeechRateLimiter,
  generateChatMessageSpeech,
)

chatRoutes.post(
  '/conversations/:conversationId/messages/:messageId/avatar-speech',
  validateParams(
    chatSpeechParamsSchema,
  ),
  chatSpeechRateLimiter,
  generateChatAvatarSpeech,
)

chatRoutes.post(
  '/conversations/:conversationId/messages/:messageId/realtime-avatar-speech',
  validateParams(
    chatSpeechParamsSchema,
  ),
  chatSpeechRateLimiter,
  generateChatRealtimeAvatarSpeech,
)

chatRoutes.post(
  '/conversations/:conversationId/messages/:messageId/realtime-avatar-speech/chunks/:chunkIndex',
  validateParams(
    realtimeAvatarSpeechChunkParamsSchema,
  ),
  chatRealtimeSpeechChunkRateLimiter,
  generateChatRealtimeAvatarSpeechChunk,
)

chatRoutes.delete(
  '/realtime-audio/:realtimeAudioToken',
  validateParams(
    realtimeAudioParamsSchema,
  ),
  releaseChatRealtimeAvatarAudio,
)

chatRoutes.get(
  '/avatar-jobs/:avatarJobId',
  validateParams(
    avatarJobParamsSchema,
  ),
  getChatAvatarJob,
)

chatRoutes.get(
  '/avatar-jobs/:avatarJobId/video',
  validateParams(
    avatarJobParamsSchema,
  ),
  getChatAvatarVideo,
)

chatRoutes.post(
  '/conversations/:conversationId/messages',
  validateParams(
    chatConversationParamsSchema,
  ),
  chatMessageRateLimiter,
  validateBody(sendChatMessageSchema),
  sendChatMessage,
)

export default chatRoutes
