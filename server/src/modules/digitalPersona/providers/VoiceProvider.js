function requireFunction(name, value) {
  if (typeof value !== 'function') {
    throw new TypeError(
      `Voice provider ${name} must be a function.`,
    )
  }
}

export function createVoiceProvider({
  name,
  createProfile,
  disableProfile,
}) {
  if (
    typeof name !== 'string' ||
    name.trim().length === 0
  ) {
    throw new TypeError(
      'Voice provider name must be a non-empty string.',
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
