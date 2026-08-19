function requireFunction(name, value) {
  if (typeof value !== 'function') {
    throw new TypeError(
      `Avatar provider ${name} must be a function.`,
    )
  }
}

export function createAvatarProvider({
  name,
  createProfile,
  disableProfile,
}) {
  if (
    typeof name !== 'string' ||
    name.trim().length === 0
  ) {
    throw new TypeError(
      'Avatar provider name must be a non-empty string.',
    )
  }

  requireFunction(
    'createProfile',
    createProfile,
  )

  requireFunction(
    'disableProfile',
    disableProfile,
  )

  return Object.freeze({
    name: name.trim(),
    createProfile,
    disableProfile,
  })
}
