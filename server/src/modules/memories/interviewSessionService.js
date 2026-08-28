import { AppError } from '../../errors/AppError.js'
import { getBiographyQuestion } from './biographyQuestionCatalog.js'
import InterviewSession from './InterviewSession.js'

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

function createPromptSnapshot(question) {
  return {
    key: question.key,
    category: question.category,
    question: question.question,
  }
}

export async function startInterviewSession({
  userId,
  memoryId,
  questionKey,
}) {
  const question =
    getBiographyQuestion(questionKey)

  if (!question) {
    throw createPromptNotFoundError()
  }

  const promptSnapshot =
    createPromptSnapshot(question)

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
