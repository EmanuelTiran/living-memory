export const SPEECH_CHUNK_FIRST_TARGET_LENGTH =
  220

export const SPEECH_CHUNK_MAX_LENGTH =
  1_900

export const SPEECH_CHUNK_MAX_COUNT = 6

const SPEECH_CHUNK_REMAINDER_TARGET_LENGTH =
  850

function normalizeSpeechText(text) {
  if (typeof text !== 'string') {
    throw new TypeError(
      'Speech text must be a string.',
    )
  }

  return text
    .trim()
    .replace(/\s+/gu, ' ')
}

function findPreferredBoundary(
  text,
  targetLength,
  maxLength,
) {
  const cappedLength = Math.min(
    text.length,
    maxLength,
  )

  if (text.length <= cappedLength) {
    return text.length
  }

  const minimumLength = Math.max(
    1,
    Math.floor(targetLength * 0.55),
  )

  const candidate = text.slice(
    0,
    cappedLength + 1,
  )

  const sentencePattern =
    /[.!?…][\]})"'״”’]*\s/gu
  let sentenceBoundary = -1
  let match

  while (
    (match = sentencePattern.exec(candidate))
  ) {
    const boundary =
      match.index + match[0].length - 1

    if (
      boundary >= minimumLength &&
      boundary <= cappedLength
    ) {
      sentenceBoundary = boundary
    }
  }

  if (sentenceBoundary > 0) {
    return sentenceBoundary
  }

  const wordBoundary =
    candidate.lastIndexOf(' ', cappedLength)

  if (wordBoundary >= minimumLength) {
    return wordBoundary
  }

  return cappedLength
}

function takeChunk(
  text,
  targetLength,
  maxLength,
) {
  const boundary = findPreferredBoundary(
    text,
    targetLength,
    maxLength,
  )

  return {
    chunk: text.slice(0, boundary).trim(),
    remainder: text.slice(boundary).trim(),
  }
}

export function splitSpeechText(text) {
  const normalizedText =
    normalizeSpeechText(text)

  if (!normalizedText) {
    return []
  }

  if (
    normalizedText.length <=
    SPEECH_CHUNK_FIRST_TARGET_LENGTH
  ) {
    return [normalizedText]
  }

  const first = takeChunk(
    normalizedText,
    SPEECH_CHUNK_FIRST_TARGET_LENGTH,
    SPEECH_CHUNK_FIRST_TARGET_LENGTH,
  )

  const chunks = [first.chunk]
  let remainder = first.remainder

  while (remainder) {
    const remainingSlots =
      SPEECH_CHUNK_MAX_COUNT - chunks.length

    if (remainingSlots <= 1) {
      chunks.push(remainder)
      break
    }

    const desiredChunkCount = Math.min(
      remainingSlots,
      Math.max(
        1,
        Math.ceil(
          remainder.length /
            SPEECH_CHUNK_REMAINDER_TARGET_LENGTH,
        ),
      ),
    )

    if (desiredChunkCount === 1) {
      chunks.push(remainder)
      break
    }

    const targetLength = Math.ceil(
      remainder.length /
        desiredChunkCount,
    )

    const next = takeChunk(
      remainder,
      targetLength,
      Math.min(
        SPEECH_CHUNK_MAX_LENGTH,
        Math.ceil(targetLength * 1.25),
      ),
    )

    chunks.push(next.chunk)
    remainder = next.remainder
  }

  if (
    chunks.length >
      SPEECH_CHUNK_MAX_COUNT ||
    chunks.some(
      (chunk) =>
        !chunk ||
        chunk.length >
          SPEECH_CHUNK_MAX_LENGTH,
    )
  ) {
    throw new RangeError(
      'Speech text could not be divided into safe chunks.',
    )
  }

  return chunks
}
