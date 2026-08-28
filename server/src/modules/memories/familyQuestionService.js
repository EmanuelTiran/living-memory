import { AppError } from '../../errors/AppError.js'
import FamilyQuestion from './FamilyQuestion.js'
import {
  createFamilyQuestionSchema,
  familyQuestionMemoryParamsSchema,
  familyQuestionParamsSchema,
} from './familyQuestionValidation.js'
import {
  MEMORY_PERMISSIONS,
  requireMemoryPermission,
} from './memoryAccessService.js'

function validateUserId(userId) {
  if (
    typeof userId !== 'string' ||
    userId.length === 0
  ) {
    throw new TypeError(
      'User ID must be a non-empty string.',
    )
  }
}

function createQuestionNotFoundError() {
  return new AppError(
    'Family question was not found.',
    {
      statusCode: 404,
      code:
        'FAMILY_QUESTION_NOT_FOUND',
    },
  )
}

function serializeQuestion(
  familyQuestion,
  userId,
) {
  const question =
    familyQuestion.toJSON()

  return {
    ...question,
    askedByCurrentUser:
      familyQuestion.askedByUserId
        ?.toString() === userId,
  }
}

export async function createFamilyQuestion(
  userId,
  memoryId,
  input,
) {
  validateUserId(userId)

  const validatedParams =
    familyQuestionMemoryParamsSchema
      .parse({
        memoryId,
      })

  const questionData =
    createFamilyQuestionSchema.parse(
      input,
    )

  await requireMemoryPermission(
    userId,
    validatedParams.memoryId,
    MEMORY_PERMISSIONS.CHAT,
  )

  const familyQuestion =
    await FamilyQuestion.create({
      memoryId:
        validatedParams.memoryId,
      askedByUserId: userId,
      question: questionData.question,
    })

  return serializeQuestion(
    familyQuestion,
    userId,
  )
}

export async function listFamilyQuestions(
  userId,
  memoryId,
) {
  validateUserId(userId)

  const validatedParams =
    familyQuestionMemoryParamsSchema
      .parse({
        memoryId,
      })

  await requireMemoryPermission(
    userId,
    validatedParams.memoryId,
    MEMORY_PERMISSIONS.VIEW,
  )

  const familyQuestions =
    await FamilyQuestion.find({
      memoryId:
        validatedParams.memoryId,
      status: 'active',
    })
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .limit(100)

  return familyQuestions.map(
    (familyQuestion) =>
      serializeQuestion(
        familyQuestion,
        userId,
      ),
  )
}

export async function getFamilyQuestionAnswerPrompt(
  memoryId,
  questionId,
) {
  const validatedParams =
    familyQuestionParamsSchema.parse({
      memoryId,
      questionId,
    })

  const familyQuestion =
    await FamilyQuestion.findOne({
      _id: validatedParams.questionId,
      memoryId:
        validatedParams.memoryId,
      status: 'active',
    })

  if (!familyQuestion) {
    throw createQuestionNotFoundError()
  }

  return {
    questionId:
      familyQuestion._id.toString(),
    questionText:
      familyQuestion.question,
  }
}
