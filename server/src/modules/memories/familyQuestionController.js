import {
  createFamilyQuestion,
  listFamilyQuestions,
} from './familyQuestionService.js'

export async function createQuestion(
  req,
  res,
) {
  const familyQuestion =
    await createFamilyQuestion(
      req.auth.userId,
      req.validatedParams.memoryId,
      req.validatedBody,
    )

  res.status(201).json({
    success: true,
    data: {
      familyQuestion,
    },
  })
}

export async function listQuestions(
  req,
  res,
) {
  const familyQuestions =
    await listFamilyQuestions(
      req.auth.userId,
      req.validatedParams.memoryId,
    )

  res.status(200).json({
    success: true,
    data: {
      familyQuestions,
    },
  })
}
