import './ChatMessageSpeechButton.css'

function ChatMessageSpeechButton({
  messageId,
  speechState,
  avatarState,
  didAvatarActive = false,
  didRealtimeAvailable = false,
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

  const isReady =
    status === 'ready'

  const error =
    isCurrentMessage &&
    status === 'error'
      ? speechState.error
      : ''

  const isCurrentAvatarMessage =
    avatarState?.messageId === messageId
  const avatarStatus = isCurrentAvatarMessage
    ? avatarState.status
    : 'idle'
  const isAvatarPreparing =
    avatarStatus === 'preparing' ||
    avatarStatus ===
      'realtime-preparing'
  const isAvatarReady =
    avatarStatus === 'ready'
  const isRealtimeSpeaking =
    avatarStatus ===
      'realtime-speaking'

  let buttonLabel =
    'השמעה מיידית בקול'

  if (isLoading) {
    buttonLabel = 'מכינים את הקול...'
  }

  if (isPlaying) {
    buttonLabel = 'עצירת ההשמעה'
  }

  if (isReady) {
    buttonLabel =
      'הקול מוכן — לחצו להפעלה'
  }

  return (
    <div className="chat-speech-control">
      <div className="chat-speech-actions">
        <button
          className={[
            'chat-speech-button',
            isPlaying
              ? 'chat-speech-button-playing'
              : isReady
                ? 'chat-speech-button-ready'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          type="button"
          disabled={isLoading}
          aria-pressed={isPlaying}
          aria-label={buttonLabel}
          onClick={() => onToggle(messageId)}
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

        {didAvatarActive && (
          <button
            className="chat-speech-button chat-avatar-video-button"
            type="button"
            disabled={
              isLoading ||
              isPlaying ||
              isAvatarPreparing ||
              isAvatarReady
            }
            onClick={() =>
              onToggle(messageId, {
                requestAvatarVideo:
                  !didRealtimeAvailable,
                requestRealtimeAvatar:
                  didRealtimeAvailable,
              })
            }
          >
            <span
              className="chat-speech-icon chat-avatar-video-icon"
              aria-hidden="true"
            >
              {isAvatarPreparing
                ? '…'
                : '◉'}
            </span>

            <span>
              {isAvatarPreparing
                ? 'קול עכשיו; וידאו ברקע…'
                : isRealtimeSpeaking
                  ? 'מדבר בשידור חי'
                : isAvatarReady
                  ? 'הווידאו מוכן למעלה'
                  : didRealtimeAvailable
                    ? 'קול + שפתיים בזמן אמת'
                    : 'קול עכשיו + וידאו ברקע'}
            </span>
          </button>
        )}
      </div>

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
