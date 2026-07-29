import {
    createMemoryChatConversation,
    getMemoryChatHistory,
    sendMemoryChatMessage,
  } from './chatService.js'

  export async function createChatConversation(
    req,
    res,
  ) {
    const conversation =
      await createMemoryChatConversation(
        req.auth.userId,
        req.validatedParams.memoryId,
      )

    res.status(201).json({
      success: true,
      data: {
        conversation,
      },
    })
  }

  export async function sendChatMessage(
    req,
    res,
  ) {
    const chatExchange =
      await sendMemoryChatMessage(
        req.auth.userId,
        req.validatedParams.memoryId,
        req.validatedParams.conversationId,
        req.validatedBody,
      )

    res.status(201).json({
      success: true,
      data: chatExchange,
    })
  }

  export async function getChatHistory(
    req,
    res,
  ) {
    const history =
      await getMemoryChatHistory(
        req.auth.userId,
        req.validatedParams.memoryId,
        req.validatedParams.conversationId,
        req.validatedQuery,
      )

    res.status(200).json({
      success: true,
      data: history,
    })
  }
