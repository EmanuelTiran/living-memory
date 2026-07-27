import { Buffer } from 'node:buffer'
import * as argon2 from 'argon2'

const MAX_PASSWORD_BYTES = 1024

const passwordHashOptions = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
})

function validatePassword(password) {
  if (typeof password !== 'string') {
    throw new TypeError('Password must be a string.')
  }

  const passwordSize = Buffer.byteLength(password, 'utf8')

  if (
    passwordSize === 0 ||
    passwordSize > MAX_PASSWORD_BYTES
  ) {
    throw new RangeError(
      `Password must contain between 1 and ${MAX_PASSWORD_BYTES} UTF-8 bytes.`,
    )
  }
}

function validatePasswordHash(passwordHash) {
  if (
    typeof passwordHash !== 'string' ||
    passwordHash.length === 0
  ) {
    throw new TypeError(
      'Password hash must be a non-empty string.',
    )
  }
}

export async function hashPassword(password) {
  validatePassword(password)

  return argon2.hash(password, passwordHashOptions)
}

export async function verifyPassword(
  passwordHash,
  password,
) {
  validatePasswordHash(passwordHash)
  validatePassword(password)

  return argon2.verify(passwordHash, password)
}

export function passwordNeedsRehash(passwordHash) {
  validatePasswordHash(passwordHash)

  return argon2.needsRehash(
    passwordHash,
    passwordHashOptions,
  )
}