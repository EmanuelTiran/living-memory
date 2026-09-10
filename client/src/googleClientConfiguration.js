const GOOGLE_CLIENT_ID_PATTERN =
  /^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/
const MAX_GOOGLE_CLIENT_ID_LENGTH = 255

export function getConfiguredGoogleClientId(value) {
  const candidate =
    typeof value === 'string' ? value.trim() : ''

  return (
    candidate.length <=
      MAX_GOOGLE_CLIENT_ID_LENGTH &&
    GOOGLE_CLIENT_ID_PATTERN.test(candidate)
  )
    ? candidate
    : ''
}
