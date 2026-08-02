import 'dotenv/config'
import { z } from 'zod'

export const OPENAI_SPEECH_VOICES =
  Object.freeze([
    'alloy',
    'ash',
    'ballad',
    'coral',
    'echo',
    'fable',
    'nova',
    'onyx',
    'sage',
    'shimmer',
    'verse',
    'marin',
    'cedar',
  ])

const envSchema = z.object({
  NODE_ENV: z
    .enum([
      'development',
      'test',
      'production',
    ])
    .default('development'),

  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(5000),

  MONGODB_URI: z
    .string()
    .trim()
    .min(
      1,
      'MONGODB_URI is required',
    )
    .refine(
      (value) =>
        value.startsWith(
          'mongodb://',
        ) ||
        value.startsWith(
          'mongodb+srv://',
        ),
      'MONGODB_URI must be a valid MongoDB connection string',
    ),

  ACCESS_TOKEN_SECRET: z
    .string()
    .trim()
    .min(
      43,
      'ACCESS_TOKEN_SECRET must contain at least 43 characters',
    ),

  ACCESS_TOKEN_TTL_MINUTES: z.coerce
    .number()
    .int()
    .min(5)
    .max(60)
    .default(15),

  REFRESH_TOKEN_TTL_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(90)
    .default(30),

  OPENAI_API_KEY: z
    .string()
    .trim()
    .default(''),

  OPENAI_MODEL: z
    .string()
    .trim()
    .min(
      1,
      'OPENAI_MODEL must not be empty',
    )
    .max(
      100,
      'OPENAI_MODEL must not exceed 100 characters',
    )
    .default('gpt-5.6-terra'),

  OPENAI_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(120000)
    .default(45000),

  OPENAI_MAX_OUTPUT_TOKENS: z.coerce
    .number()
    .int()
    .min(256)
    .max(16000)
    .default(4000),

  OPENAI_TRANSCRIPTION_MODEL: z
    .string()
    .trim()
    .min(
      1,
      'OPENAI_TRANSCRIPTION_MODEL must not be empty',
    )
    .max(
      100,
      'OPENAI_TRANSCRIPTION_MODEL must not exceed 100 characters',
    )
    .default('gpt-transcribe'),

  OPENAI_TRANSCRIPTION_TIMEOUT_MS:
    z.coerce
      .number()
      .int()
      .min(5000)
      .max(300000)
      .default(120000),

  OPENAI_SPEECH_MODEL: z
    .string()
    .trim()
    .min(
      1,
      'OPENAI_SPEECH_MODEL must not be empty',
    )
    .max(
      100,
      'OPENAI_SPEECH_MODEL must not exceed 100 characters',
    )
    .default('gpt-4o-mini-tts'),

  OPENAI_SPEECH_VOICE: z
    .enum(
      OPENAI_SPEECH_VOICES,
      {
        error:
          'OPENAI_SPEECH_VOICE is not supported',
      },
    )
    .default('marin'),

  OPENAI_SPEECH_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(120000)
    .default(60000),

  RECORDING_STORAGE_ROOT: z
    .string()
    .trim()
    .min(
      1,
      'RECORDING_STORAGE_ROOT must not be empty',
    )
    .max(
      1000,
      'RECORDING_STORAGE_ROOT must not exceed 1000 characters',
    )
    .refine(
      (value) =>
        !value.includes('\u0000'),
      'RECORDING_STORAGE_ROOT contains invalid characters',
    )
    .default('./uploads/recordings'),
})

const result =
  envSchema.safeParse(process.env)

if (!result.success) {
  const errors = result.error.issues
    .map(
      (issue) =>
        `${issue.path.join('.')}: ${issue.message}`,
    )
    .join(', ')

  throw new Error(
    `Invalid environment configuration: ${errors}`,
  )
}

export const env = Object.freeze({
  nodeEnv: result.data.NODE_ENV,
  port: result.data.PORT,
  mongodbUri:
    result.data.MONGODB_URI,
  accessTokenSecret:
    result.data.ACCESS_TOKEN_SECRET,
  accessTokenTtlMinutes:
    result.data
      .ACCESS_TOKEN_TTL_MINUTES,
  refreshTokenTtlDays:
    result.data
      .REFRESH_TOKEN_TTL_DAYS,
  openaiApiKey:
    result.data.OPENAI_API_KEY,
  openaiModel:
    result.data.OPENAI_MODEL,
  openaiTimeoutMs:
    result.data.OPENAI_TIMEOUT_MS,
  openaiMaxOutputTokens:
    result.data
      .OPENAI_MAX_OUTPUT_TOKENS,
  openaiTranscriptionModel:
    result.data
      .OPENAI_TRANSCRIPTION_MODEL,
  openaiTranscriptionTimeoutMs:
    result.data
      .OPENAI_TRANSCRIPTION_TIMEOUT_MS,
  openaiSpeechModel:
    result.data.OPENAI_SPEECH_MODEL,
  openaiSpeechVoice:
    result.data.OPENAI_SPEECH_VOICE,
  openaiSpeechTimeoutMs:
    result.data
      .OPENAI_SPEECH_TIMEOUT_MS,
  recordingStorageRoot:
    result.data
      .RECORDING_STORAGE_ROOT,
})
