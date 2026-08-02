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
  chatConversationParamsSchema,
  chatHistoryQuerySchema,
  chatMemoryParamsSchema,
  sendChatMessageSchema,
} from './validation.js'
import {
  generateChatMessageSpeech,
} from '../voice/speechController.js'
import {
  chatSpeechRateLimiter,
} from '../voice/speechRateLimiter.js'
import {
  chatSpeechParamsSchema,
} from '../voice/speechValidation.js'

const chatRoutes = Router({
  mergeParams: true,
})

chatRoutes.use(requireAuth)

chatRoutes.post(
  '/conversations',
  validateParams(chatMemoryParamsSchema),
  createChatConversation,
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
  '/conversations/:conversationId/messages',
  validateParams(
    chatConversationParamsSchema,
  ),
  chatMessageRateLimiter,
  validateBody(sendChatMessageSchema),
  sendChatMessage,
)

export default chatRoutes
