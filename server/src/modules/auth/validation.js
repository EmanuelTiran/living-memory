import { z } from 'zod'

export const emailSchema = z
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

const passwordResetTokenSchema = z
  .string({
    error: 'Password reset token must be a string.',
  })
  .trim()
  .regex(
    /^[A-Za-z0-9_-]{43}$/,
    'Password reset token is invalid.',
  )

const invitationTokenSchema = z
  .string({
    error: 'Invitation token must be a string.',
  })
  .trim()
  .regex(
    /^[A-Za-z0-9_-]{43}$/,
    'Invitation token is invalid.',
  )

function hasControlCharacter(value) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0)

    return codePoint <= 31 || codePoint === 127
  })
}

const redirectParameterPattern =
  /^(?:continue|next|redirect(?:_?(?:to|uri|url))?|return_?to)$/i
const MAX_RETURN_TO_DECODE_PASSES = 8

function isInternalReturnTo(
  value,
  nestedDepth = 0,
) {
  const internalOrigin =
    'https://living-memory.invalid'

  if (nestedDepth > 8) {
    return false
  }

  try {
    let candidate = value

    for (
      let pass = 0;
      pass <= MAX_RETURN_TO_DECODE_PASSES;
      pass += 1
    ) {
      if (
        !candidate.startsWith('/') ||
        candidate.startsWith('//') ||
        candidate.includes('\\') ||
        hasControlCharacter(candidate)
      ) {
        return false
      }

      const destination = new URL(
        candidate,
        internalOrigin,
      )

      if (destination.origin !== internalOrigin) {
        return false
      }

      if (
        /^\/api(?:\/|$)/i.test(
          destination.pathname,
        )
      ) {
        return false
      }

      for (const [name, parameterValue] of
        destination.searchParams) {
        if (
          redirectParameterPattern.test(name) &&
          !isInternalReturnTo(
            parameterValue,
            nestedDepth + 1,
          )
        ) {
          return false
        }
      }

      const decoded = decodeURIComponent(candidate)

      if (decoded === candidate) {
        return true
      }

      candidate = decoded
    }

    return false
  } catch {
    return false
  }
}

const internalReturnToSchema = z
  .string({
    error: 'Return destination must be a string.',
  })
  .trim()
  .min(1, {
    error: 'Return destination is required.',
  })
  .max(2_048, {
    error: 'Return destination is too long.',
  })
  .refine(
    isInternalReturnTo,
    'Return destination must be an internal path.',
  )

export const googleCredentialSchema = z
  .string({
    error: 'Google credential must be a string.',
  })
  .trim()
  .min(100, {
    error: 'Google credential is invalid.',
  })
  .max(20_000, {
    error: 'Google credential is too large.',
  })
  .regex(
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
    'Google credential is invalid.',
  )

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
  invitationToken: invitationTokenSchema.optional(),
})

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: loginPasswordSchema,
})

export const forgotPasswordSchema =
  z.strictObject({
    email: emailSchema,
  })

export const resetPasswordSchema =
  z.strictObject({
    token: passwordResetTokenSchema,
    password: registrationPasswordSchema,
  })

export const googleAuthenticationSchema =
  z.strictObject({
    credential: googleCredentialSchema,
    invitationToken: invitationTokenSchema.optional(),
  })

export const googleRedirectContextSchema =
  z.strictObject({
    mode: z.enum(['login', 'register']),
    returnTo: internalReturnToSchema,
    invitationToken:
      invitationTokenSchema.optional(),
  })

export const googleRedirectStateSchema = z
  .string({
    error: 'Google redirect state must be a string.',
  })
  .trim()
  .max(5_000, {
    error: 'Google redirect state is too large.',
  })
  .regex(
    /^[A-Za-z0-9_-]+\.\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
    'Google redirect state is invalid.',
  )

export const googleRedirectAuthenticationSchema =
  z.object({
    credential: googleCredentialSchema,
    g_csrf_token: z
      .string({
        error: 'Google CSRF token must be a string.',
      })
      .min(1, {
        error: 'Google CSRF token is required.',
      })
      .max(2_048, {
        error: 'Google CSRF token is too large.',
      }),
    state: googleRedirectStateSchema,
  })

export const googleRedirectRecoveryRequestSchema =
  z.strictObject({})
