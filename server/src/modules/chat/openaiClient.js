import OpenAI from 'openai'
import { env } from '../../config/env.js'
import { AppError } from '../../errors/AppError.js'

let sharedOpenAIClient = null

function isConfiguredApiKey(apiKey) {
  return (
    typeof apiKey === 'string' &&
    apiKey.length > 0 &&
    !apiKey.startsWith(
      'REPLACE_WITH_',
    ) &&
    !apiKey.startsWith('YOUR_')
  )
}

function createConfigurationError() {
  return new AppError(
    'The AI service is not configured.',
    {
      statusCode: 503,
      code:
        'AI_SERVICE_NOT_CONFIGURED',
    },
  )
}

export function createOpenAIClient({
  apiKey = env.openaiApiKey,
  timeout = env.openaiTimeoutMs,
} = {}) {
  if (!isConfiguredApiKey(apiKey)) {
    throw createConfigurationError()
  }

  return new OpenAI({
    apiKey,
    timeout,
    maxRetries: 1,
  })
}

export function getOpenAIClient() {
  if (!sharedOpenAIClient) {
    sharedOpenAIClient =
      createOpenAIClient()
  }

  return sharedOpenAIClient
}