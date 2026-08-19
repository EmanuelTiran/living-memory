export function getRealtimeSpeechStrategy({
  requestRealtimeAvatar = false,
  realtimeText = '',
  textSpeechAvailable = false,
} = {}) {
  const normalizedText =
    typeof realtimeText === 'string'
      ? realtimeText.trim()
      : ''

  if (
    requestRealtimeAvatar &&
    textSpeechAvailable &&
    normalizedText
  ) {
    return {
      mode: 'direct-text',
      text: normalizedText,
    }
  }

  return {
    mode: 'generated-audio',
    text: '',
  }
}
