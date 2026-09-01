import { AppError } from '../../errors/AppError.js'
import ChatMessage from '../chat/ChatMessage.js'
import MemoryRecording from '../media/MemoryRecording.js'
import MemoryBiographyAnswer from './MemoryBiographyAnswer.js'
import {
  BIOGRAPHY_QUESTION_BATCH_SIZE,
  BIOGRAPHY_QUESTIONS,
  getBiographyQuestion,
} from './biographyQuestionCatalog.js'
import {
  biographyQuestionnaireAnswerParamsSchema,
  biographyQuestionnaireParamsSchema,
  creativeChatPromotionParamsSchema,
  promoteCreativeChatReplySchema,
  saveBiographyQuestionnaireResponseSchema,
} from './biographyValidation.js'
import {
  MEMORY_PERMISSIONS,
  requireMemoryPermission,
} from './memoryAccessService.js'
import {
  personalizeBiographyQuestion,
} from './subjectLanguage.js'

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

function createCreativeMessageNotFoundError() {
  return new AppError(
    'Creative chat message was not found.',
    {
      statusCode: 404,
      code:
        'CREATIVE_CHAT_MESSAGE_NOT_FOUND',
    },
  )
}

function createBiographySourceExistsError() {
  return new AppError(
    'This creative response is already stored as a biography source.',
    {
      statusCode: 409,
      code:
        'BIOGRAPHY_SOURCE_EXISTS',
    },
  )
}

function createBiographyQuestionNotFoundError() {
  return new AppError(
    'Biography question was not found.',
    {
      statusCode: 404,
      code:
        'BIOGRAPHY_QUESTION_NOT_FOUND',
    },
  )
}

function createBiographyOptionInvalidError() {
  return new AppError(
    'The selected biography option is invalid.',
    {
      statusCode: 400,
      code:
        'BIOGRAPHY_OPTION_INVALID',
    },
  )
}

function createBiographyAnswerConflictError() {
  return new AppError(
    'The biography answer could not be saved because it was changed by another request.',
    {
      statusCode: 409,
      code:
        'BIOGRAPHY_ANSWER_CONFLICT',
    },
  )
}

function isDuplicateKeyError(error) {
  return error?.code === 11000
}

function serializeQuestion(
  question,
  subject,
) {
  const personalizedQuestion =
    personalizeBiographyQuestion(
      question,
      subject,
    )

  return {
    key: personalizedQuestion.key,
    category:
      personalizedQuestion.category,
    question:
      personalizedQuestion.question,
    options:
      personalizedQuestion.options.map(
      (option) => ({
        key: option.key,
        label: option.label,
      }),
    ),
  }
}

function serializeBiographyAnswer(
  biographyAnswer,
  subject,
) {
  const serialized =
    typeof biographyAnswer.toJSON ===
    'function'
      ? biographyAnswer.toJSON()
      : {
          ...biographyAnswer,
        }

  const questionDefinition =
    getBiographyQuestion(
      serialized.questionKey,
    )

  const personalizedQuestion =
    questionDefinition
      ? personalizeBiographyQuestion(
          questionDefinition,
          subject,
        )
      : null

  const selectedOption =
    questionDefinition?.options.find(
      (option) =>
        option.label ===
          serialized.answer ||
        personalizedQuestion?.options
          .find(
            (personalizedOption) =>
              personalizedOption.key ===
                option.key,
          )
          ?.label === serialized.answer,
    ) ?? null

  return {
    ...serialized,
    selectedOptionKey:
      selectedOption?.key ?? null,
    questionDefinition:
      questionDefinition
        ? serializeQuestion(
            questionDefinition,
            subject,
          )
        : null,
  }
}

function resolveQuestionnaireAnswer(
  question,
  response,
  subject,
) {
  if ('customAnswer' in response) {
    return response.customAnswer
  }

  const selectedOption =
    personalizeBiographyQuestion(
      question,
      subject,
    ).options.find(
      (option) =>
        option.key ===
        response.optionKey,
    )

  if (!selectedOption) {
    throw createBiographyOptionInvalidError()
  }

  return selectedOption.label
}

async function loadQuestionnaireAnswers(
  memoryId,
) {
  return MemoryBiographyAnswer.find({
    memoryId,
    origin: 'questionnaire',
    status: {
      $in: [
        'draft',
        'approved',
      ],
    },
  }).sort({
    updatedAt: -1,
  })
}

async function loadStoredInterviewPromptKeys(
  memoryId,
) {
  return MemoryRecording.distinct(
    'interviewContext.promptKey',
    {
      memoryId,
      lifecycleStatus: 'active',
      storageStatus: 'stored',
      'interviewContext.promptKey': {
        $exists: true,
        $ne: '',
      },
    },
  )
}

export function createQuestionnaireResult(
  biographyAnswers,
  storedInterviewPromptKeys = [],
  subject = {},
) {
  const knownQuestionKeys = new Set(
    [
      ...biographyAnswers.map(
        (answer) =>
          answer.questionKey,
      ),
      ...storedInterviewPromptKeys,
    ]
      .filter((questionKey) =>
        Boolean(
          getBiographyQuestion(
            questionKey,
          ),
        ),
      ),
  )

  const unansweredQuestions =
    BIOGRAPHY_QUESTIONS.filter(
      (question) =>
        !knownQuestionKeys.has(
          question.key,
        ),
    )

  const completedCount =
    knownQuestionKeys.size

  const totalCount =
    BIOGRAPHY_QUESTIONS.length

  return {
    unansweredQuestions:
      unansweredQuestions.map(
        (question) =>
          serializeQuestion(
            question,
            subject,
          ),
      ),

    questions: unansweredQuestions
      .slice(
        0,
        BIOGRAPHY_QUESTION_BATCH_SIZE,
      )
      .map((question) =>
        serializeQuestion(
          question,
          subject,
        ),
      ),

    answers:
      biographyAnswers.map(
        (answer) =>
          serializeBiographyAnswer(
            answer,
            subject,
          ),
      ),

    answeredQuestions:
      BIOGRAPHY_QUESTIONS
        .filter((question) =>
          knownQuestionKeys.has(
            question.key,
          ),
        )
        .map((question) =>
          serializeQuestion(
            question,
            subject,
          ),
        ),

    progress: {
      totalCount,
      completedCount,
      remainingCount:
        totalCount - completedCount,
      batchSize:
        BIOGRAPHY_QUESTION_BATCH_SIZE,
      isComplete:
        completedCount === totalCount,
    },
  }
}

export async function getBiographyQuestionnaire(
  userId,
  memoryId,
) {
  validateUserId(userId)

  const validatedParams =
    biographyQuestionnaireParamsSchema
      .parse({
        memoryId,
      })

  const access =
    await requireMemoryPermission(
      userId,
      validatedParams.memoryId,
      MEMORY_PERMISSIONS.MANAGE,
    )

  const memoryProfile =
    access?.memoryProfile ?? {}

  const [
    biographyAnswers,
    storedInterviewPromptKeys,
  ] = await Promise.all([
    loadQuestionnaireAnswers(
      validatedParams.memoryId,
    ),
    loadStoredInterviewPromptKeys(
      validatedParams.memoryId,
    ),
  ])

  return createQuestionnaireResult(
    biographyAnswers,
    storedInterviewPromptKeys,
    {
      subjectName:
        memoryProfile.subjectName,
      subjectGender:
        memoryProfile.subjectGender,
    },
  )
}

export async function saveBiographyQuestionnaireAnswer(
  userId,
  memoryId,
  questionKey,
  input,
) {
  validateUserId(userId)

  const validatedParams =
    biographyQuestionnaireAnswerParamsSchema
      .parse({
        memoryId,
        questionKey,
      })

  const validatedInput =
    saveBiographyQuestionnaireResponseSchema
      .parse(input)

  const question =
    getBiographyQuestion(
      validatedParams.questionKey,
    )

  if (!question) {
    throw createBiographyQuestionNotFoundError()
  }

  resolveQuestionnaireAnswer(
    question,
    validatedInput,
    {},
  )

  const access =
    await requireMemoryPermission(
      userId,
      validatedParams.memoryId,
      MEMORY_PERMISSIONS.MANAGE,
    )

  const memoryProfile =
    access?.memoryProfile ?? {}

  const subject = {
    subjectName:
      memoryProfile.subjectName,
    subjectGender:
      memoryProfile.subjectGender,
  }

  const personalizedQuestion =
    personalizeBiographyQuestion(
      question,
      subject,
    )

  const answer =
    resolveQuestionnaireAnswer(
      question,
      validatedInput,
      subject,
    )

  const existingAnswer =
    await MemoryBiographyAnswer.findOne({
      memoryId:
        validatedParams.memoryId,
      origin: 'questionnaire',
      questionKey:
        validatedParams.questionKey,
    })

  const approvedAt = new Date()

  if (existingAnswer) {
    existingAnswer.question =
      personalizedQuestion.question
    existingAnswer.answer = answer
    existingAnswer.status =
      'approved'
    existingAnswer.approvedAt =
      approvedAt
    existingAnswer.approvedByUserId =
      userId
    existingAnswer.revision =
      (existingAnswer.revision ?? 0) + 1

    await existingAnswer.save()

    return serializeBiographyAnswer(
      existingAnswer,
      subject,
    )
  }

  let biographyAnswer

  try {
    biographyAnswer =
      await MemoryBiographyAnswer.create({
        memoryId:
          validatedParams.memoryId,
        createdByUserId: userId,
        questionKey:
          validatedParams.questionKey,
        question:
          personalizedQuestion.question,
        answer,
        origin: 'questionnaire',
        status: 'approved',
        approvedAt,
        approvedByUserId: userId,
        revision: 1,
      })
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw createBiographyAnswerConflictError()
    }

    throw error
  }

  return serializeBiographyAnswer(
    biographyAnswer,
    subject,
  )
}

export async function promoteCreativeChatReply(
  userId,
  memoryId,
  messageId,
  input,
) {
  validateUserId(userId)

  const validatedParams =
    creativeChatPromotionParamsSchema
      .parse({
        memoryId,
        messageId,
      })

  const validatedInput =
    promoteCreativeChatReplySchema
      .parse(input)

  await requireMemoryPermission(
    userId,
    validatedParams.memoryId,
    MEMORY_PERMISSIONS.MANAGE,
  )

  const creativeMessageExists =
    await ChatMessage.exists({
      _id: validatedParams.messageId,
      memoryId:
        validatedParams.memoryId,
      participantUserId: userId,
      role: 'assistant',
      groundingStatus: 'creative',
    })

  if (!creativeMessageExists) {
    throw createCreativeMessageNotFoundError()
  }

  const existingBiographySource =
    await MemoryBiographyAnswer.exists({
      memoryId:
        validatedParams.memoryId,
      origin: 'creative_chat',
      sourceChatMessageId:
        validatedParams.messageId,
    })

  if (existingBiographySource) {
    throw createBiographySourceExistsError()
  }

  const approvedAt = new Date()

  let biographyAnswer

  try {
    biographyAnswer =
      await MemoryBiographyAnswer.create({
        memoryId:
          validatedParams.memoryId,
        createdByUserId: userId,
        question:
          validatedInput.question,
        answer:
          validatedInput.answer,
        origin: 'creative_chat',
        sourceChatMessageId:
          validatedParams.messageId,
        status: 'approved',
        approvedAt,
        approvedByUserId: userId,
        revision: 1,
      })
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw createBiographySourceExistsError()
    }

    throw error
  }

  return biographyAnswer.toJSON()
}