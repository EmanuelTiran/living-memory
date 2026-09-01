import { AppError } from '../../errors/AppError.js'
import { getBiographyQuestion } from './biographyQuestionCatalog.js'
import InterviewSession from './InterviewSession.js'
import {
  personalizeBiographyQuestion,
} from './subjectLanguage.js'

function createPromptNotFoundError() {
  return new AppError(
    'Interview prompt was not found.',
    {
      statusCode: 404,
      code:
        'INTERVIEW_PROMPT_NOT_FOUND',
    },
  )
}

function createPromptSnapshot(
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
  }
}

export async function startInterviewSession({
  userId,
  memoryId,
  questionKey,
  subject,
}) {
  const question =
    getBiographyQuestion(questionKey)

  if (!question) {
    throw createPromptNotFoundError()
  }

  const promptSnapshot =
    createPromptSnapshot(
      question,
      subject,
    )

  const session =
    await InterviewSession.create({
      memoryId,
      startedByUserId: userId,
      promptSnapshot,
      status: 'active',
      startedAt: new Date(),
    })

  return {
    session,
    promptSnapshot,
  }
}

export async function discardInterviewSession(
  sessionId,
) {
  await InterviewSession.deleteOne({
    _id: sessionId,
    status: 'active',
  })
}

export async function completeInterviewSession({
  sessionId,
  memoryId,
  userId,
}) {
  if (!sessionId) {
    return
  }

  await InterviewSession.findOneAndUpdate(
    {
      _id: sessionId,
      memoryId,
      startedByUserId: userId,
      status: 'active',
    },
    {
      $set: {
        status: 'completed',
        completedAt: new Date(),
      },
    },
    {
      runValidators: true,
    },
  )
}
