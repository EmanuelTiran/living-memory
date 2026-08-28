import { z } from 'zod'

const emailSchema = z
  .string({
    error: 'Email must be a string.',
  })
  .trim()
  .toLowerCase()
  .max(254, {
    error: 'Email must not exceed 254 characters.',
  })
  .pipe(
    z.email({
      error: 'Email must be valid.',
    }),
  )

const registrationPasswordSchema = z
  .string({
    error: 'Password must be a string.',
  })
  .min(15, {
    error: 'Password must contain at least 15 characters.',
  })
  .max(128, {
    error: 'Password must not exceed 128 characters.',
  })

const loginPasswordSchema = z
  .string({
    error: 'Password must be a string.',
  })
  .min(1, {
    error: 'Password is required.',
  })
  .max(128, {
    error: 'Password must not exceed 128 characters.',
  })

export const registerSchema = z.strictObject({
  displayName: z
    .string({
      error: 'Display name must be a string.',
    })
    .trim()
    .min(2, {
      error: 'Display name must contain at least 2 characters.',
    })
    .max(80, {
      error: 'Display name must not exceed 80 characters.',
    }),

  email: emailSchema,
  password: registrationPasswordSchema,
  invitationToken: z
    .string({
      error: 'Invitation token must be a string.',
    })
    .trim()
    .regex(
      /^[A-Za-z0-9_-]{43}$/,
      'Invitation token is invalid.',
    )
    .optional(),
})

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: loginPasswordSchema,
})