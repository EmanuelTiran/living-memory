import {
    getBiographyQuestionnaire,
    promoteCreativeChatReply,
    saveBiographyQuestionnaireAnswer,
  } from './biographyService.js'

  export async function getQuestionnaire(
    req,
    res,
  ) {
    const questionnaire =
      await getBiographyQuestionnaire(
        req.auth.userId,
        req.validatedParams.memoryId,
      )

    res.status(200).json({
      success: true,
      data: {
        questionnaire,
      },
    })
  }

  export async function saveQuestionnaireAnswer(
    req,
    res,
  ) {
    const biographyAnswer =
      await saveBiographyQuestionnaireAnswer(
        req.auth.userId,
        req.validatedParams.memoryId,
        req.validatedParams.questionKey,
        req.validatedBody,
      )

    res.status(200).json({
      success: true,
      data: {
        biographyAnswer,
      },
    })
  }

  export async function promoteCreativeMessage(
    req,
    res,
  ) {
    const biographyAnswer =
      await promoteCreativeChatReply(
        req.auth.userId,
        req.validatedParams.memoryId,
        req.validatedParams.messageId,
        req.validatedBody,
      )

    res.status(201).json({
      success: true,
      data: {
        biographyAnswer,
      },
    })
  }
