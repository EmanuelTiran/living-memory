import './ChatMessageSpeechButton.css'

function ChatMessageSpeechButton({
  messageId,
  speechState,
  onToggle,
}) {
  const isCurrentMessage =
    speechState.messageId === messageId

  const status = isCurrentMessage
    ? speechState.status
    : 'idle'

  const isLoading =
    status === 'loading'

  const isPlaying =
    status === 'playing'

  const error =
    isCurrentMessage &&
    status === 'error'
      ? speechState.error
      : ''

  let buttonLabel =
    'השמעת התשובה'

  if (isLoading) {
    buttonLabel = 'מכינים את הקול...'
  }

  if (isPlaying) {
    buttonLabel = 'עצירת ההשמעה'
  }

  return (
    <div className="chat-speech-control">
      <button
        className={[
          'chat-speech-button',
          isPlaying
            ? 'chat-speech-button-playing'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
        type="button"
        disabled={isLoading}
        aria-pressed={isPlaying}
        aria-label={buttonLabel}
        onClick={() =>
          onToggle(messageId)
        }
      >
        <span
          className="chat-speech-icon"
          aria-hidden="true"
        >
          {isLoading
            ? '…'
            : isPlaying
              ? '■'
              : '▶'}
        </span>

        <span>{buttonLabel}</span>
      </button>

      {error && (
        <p
          className="chat-speech-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  )
}

export default ChatMessageSpeechButton
