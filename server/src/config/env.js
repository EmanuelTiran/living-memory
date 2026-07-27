import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
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
    .min(1, 'MONGODB_URI is required')
    .refine(
      (value) =>
        value.startsWith('mongodb://') ||
        value.startsWith('mongodb+srv://'),
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
})

const result = envSchema.safeParse(process.env)

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
  mongodbUri: result.data.MONGODB_URI,
  accessTokenSecret: result.data.ACCESS_TOKEN_SECRET,
  accessTokenTtlMinutes:
    result.data.ACCESS_TOKEN_TTL_MINUTES,
  refreshTokenTtlDays:
    result.data.REFRESH_TOKEN_TTL_DAYS,
})