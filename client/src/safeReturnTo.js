const FALLBACK_RETURN_TO = '/app'
const INTERNAL_ORIGIN =
  'https://living-memory.invalid'
const MAX_RETURN_TO_LENGTH = 2_048

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
        INTERNAL_ORIGIN,
      )

      if (destination.origin !== INTERNAL_ORIGIN) {
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

export function getSafeReturnTo(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_RETURN_TO_LENGTH ||
    !isInternalReturnTo(value)
  ) {
    return FALLBACK_RETURN_TO
  }

  return value
}
