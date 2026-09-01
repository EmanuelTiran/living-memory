import 'dotenv/config'
import path from 'node:path'
import { z } from 'zod'

const optionalBooleanSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional()

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

  PILOT_INVITE_ONLY:
    optionalBooleanSchema,

  PILOT_AVATAR_ENABLED:
    optionalBooleanSchema,

  SERVE_CLIENT_BUILD:
    optionalBooleanSchema,

  PERSISTENT_STORAGE_REQUIRED:
    optionalBooleanSchema,

  TRUST_PROXY_HOPS: z.coerce
    .number()
    .int()
    .min(0)
    .max(2)
    .optional(),

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

  ELEVENLABS_API_KEY: z
    .string()
    .trim()
    .default(''),

  ELEVENLABS_VOICE_ID: z
    .string()
    .trim()
    .refine(
      (value) =>
        value.length === 0 ||
        /^[A-Za-z0-9_-]{10,100}$/.test(
          value,
        ),
      'ELEVENLABS_VOICE_ID is invalid',
    )
    .default(''),

  ELEVENLABS_MODEL_ID: z
    .literal('eleven_v3')
    .default('eleven_v3'),

  ELEVENLABS_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(10000)
    .max(300000)
    .default(120000),

  DID_API_KEY: z
    .string()
    .trim()
    .default(''),

  DID_API_KEY_MODE: z
    .enum([
      'ENCODE_UTF8',
      'PRE_ENCODED',
    ])
    .default('ENCODE_UTF8'),

  DID_AGENT_ID: z
    .string()
    .trim()
    .refine(
      (value) =>
        value.length === 0 ||
        /^(?:v2_)?agt_[A-Za-z0-9_-]{6,100}$/.test(
          value,
        ),
      'DID_AGENT_ID is invalid',
    )
    .default(''),

  DID_CLIENT_KEY: z
    .string()
    .trim()
    .refine(
      (value) =>
        value.length === 0 ||
        (value.length >= 20 &&
          value.length <= 4000 &&
          !/\s/.test(value)),
      'DID_CLIENT_KEY is invalid',
    )
    .default(''),

  DID_AVATAR_IMAGE_PATH: z
    .string()
    .trim()
    .min(1)
    .max(1000)
    .refine(
      (value) =>
        !value.includes('\u0000'),
      'DID_AVATAR_IMAGE_PATH contains invalid characters',
    )
    .default(
      './assets/default-memory-avatar.png',
    ),

  DID_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(10000)
    .max(300000)
    .default(120000),

  DID_POLL_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(500)
    .max(10000)
    .default(2000),

  DID_POLL_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(30000)
    .max(600000)
    .default(240000),

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

  MEMORY_ASSET_STORAGE_ROOT: z
    .string()
    .trim()
    .min(
      1,
      'MEMORY_ASSET_STORAGE_ROOT must not be empty',
    )
    .max(
      1000,
      'MEMORY_ASSET_STORAGE_ROOT must not exceed 1000 characters',
    )
    .refine(
      (value) =>
        !value.includes('\u0000'),
      'MEMORY_ASSET_STORAGE_ROOT contains invalid characters',
    )
    .default('./uploads/memory-assets'),
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

const isProduction =
  result.data.NODE_ENV === 'production'

const persistentStorageRequired =
  result.data.PERSISTENT_STORAGE_REQUIRED ??
  isProduction

if (
  persistentStorageRequired &&
  (!path.isAbsolute(
    result.data.RECORDING_STORAGE_ROOT,
  ) ||
    !path.isAbsolute(
      result.data.MEMORY_ASSET_STORAGE_ROOT,
    ))
) {
  throw new Error(
    'Invalid environment configuration: production storage roots must be absolute paths when PERSISTENT_STORAGE_REQUIRED=true',
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
  pilotInviteOnly:
    result.data.PILOT_INVITE_ONLY ??
    isProduction,
  pilotAvatarEnabled:
    result.data.PILOT_AVATAR_ENABLED ??
    !isProduction,
  serveClientBuild:
    result.data.SERVE_CLIENT_BUILD ??
    isProduction,
  persistentStorageRequired,
  trustProxyHops:
    result.data.TRUST_PROXY_HOPS ??
    (isProduction ? 1 : 0),
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
  elevenLabsApiKey:
    result.data.ELEVENLABS_API_KEY,
  elevenLabsVoiceId:
    result.data.ELEVENLABS_VOICE_ID,
  elevenLabsModelId:
    result.data.ELEVENLABS_MODEL_ID,
  elevenLabsTimeoutMs:
    result.data.ELEVENLABS_TIMEOUT_MS,
  didApiKey:
    result.data.DID_API_KEY,
  didApiKeyMode:
    result.data.DID_API_KEY_MODE,
  didAgentId:
    result.data.DID_AGENT_ID,
  didClientKey:
    result.data.DID_CLIENT_KEY,
  didAvatarImagePath:
    result.data.DID_AVATAR_IMAGE_PATH,
  didTimeoutMs:
    result.data.DID_TIMEOUT_MS,
  didPollIntervalMs:
    result.data.DID_POLL_INTERVAL_MS,
  didPollTimeoutMs:
    result.data.DID_POLL_TIMEOUT_MS,
  recordingStorageRoot:
    result.data
      .RECORDING_STORAGE_ROOT,
  memoryAssetStorageRoot:
    result.data
      .MEMORY_ASSET_STORAGE_ROOT,
})
