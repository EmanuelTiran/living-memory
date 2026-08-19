import {
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  getChatAvatarPresentation,
} from './chatAvatarPresentation.js'
import './ChatAvatarStage.css'

function RealtimeAvatarVideo({
  active,
  audioEnabled,
  mediaStream,
  poster,
  subjectName,
}) {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current

    if (!video || !mediaStream) {
      return undefined
    }

    video.srcObject = mediaStream
    video.muted = !audioEnabled
    void video.play().catch(() => {})

    return () => {
      if (video.srcObject === mediaStream) {
        video.srcObject = null
      }
    }
  }, [audioEnabled, mediaStream])

  return (
    <video
      ref={videoRef}
      className={[
        'chat-avatar-realtime-video',
        active
          ? 'chat-avatar-realtime-video-active'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
      poster={poster}
      autoPlay
      muted={!audioEnabled}
      playsInline
      aria-hidden={!active}
      aria-label={`שידור חי של אווטאר AI של ${subjectName}`}
    />
  )
}

function ChatAvatarStage({
  subjectName,
  avatar,
  speechState,
  avatarState,
  voiceInputPhase = 'idle',
  isSending = false,
  liveConversationAvailable = false,
  liveConversationEnabled = true,
  onLiveConversationChange,
  realtimeAvatar,
}) {
  const [openedVideoUrl, setOpenedVideoUrl] =
    useState('')

  if (!avatar?.localFallbackAvailable) {
    return null
  }

  const localAssetUrl =
    avatar.localAssetUrl ??
    '/assets/emanuel-living-memory-avatar.png'
  const isSpeaking =
    speechState.status === 'playing'
  const hasVideo =
    avatarState.status === 'ready' &&
    Boolean(avatarState.videoUrl)
  const isVideoOpen =
    hasVideo &&
    openedVideoUrl === avatarState.videoUrl
  const hasRealtimeStream = Boolean(
    realtimeAvatar?.mediaStream,
  )
  const isRealtimeSpeaking =
    realtimeAvatar?.status === 'speaking'
  const isRealtimeSequenceActive =
    avatarState.status ===
      'realtime-speaking' ||
    avatarState.status ===
      'realtime-preparing'
  const keepRealtimeVideoVisible =
    isRealtimeSpeaking ||
    isRealtimeSequenceActive

  const presentation =
    getChatAvatarPresentation({
      voiceInputPhase,
      isSending,
      speechStatus: speechState.status,
      avatarStatus: avatarState.status,
      realtimeStatus:
        realtimeAvatar?.status,
    })

  const imageClassName = [
    'chat-avatar-image',
    `chat-avatar-image-${presentation.mode}`,
    isSpeaking
      ? 'chat-avatar-image-speaking'
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section
      className="chat-avatar-stage"
      aria-label={`אווטאר AI של ${subjectName}`}
    >
      <div className="chat-avatar-media">
        {hasVideo && isVideoOpen ? (
          <video
            key={avatarState.videoUrl}
            src={avatarState.videoUrl}
            poster={localAssetUrl}
            controls
            playsInline
            preload="metadata"
            aria-label={`וידאו אווטאר AI של ${subjectName}`}
          />
        ) : (
          <>
            <img
              className={imageClassName}
              src={localAssetUrl}
              alt={`איור אווטאר AI מסוגנן של ${subjectName}`}
            />

            {hasRealtimeStream && (
              <RealtimeAvatarVideo
                active={
                  keepRealtimeVideoVisible
                }
                audioEnabled={
                  isRealtimeSpeaking &&
                  realtimeAvatar
                    .streamAudioEnabled ===
                    true
                }
                mediaStream={
                  realtimeAvatar.mediaStream
                }
                poster={localAssetUrl}
                subjectName={subjectName}
              />
            )}
          </>
        )}

        <div
          className={`chat-avatar-status chat-avatar-status-${presentation.mode}`}
          role="status"
          aria-live="polite"
        >
          <span
            className="chat-avatar-status-dot"
            aria-hidden="true"
          />
          <strong>{presentation.label}</strong>
        </div>

        <div
          className="chat-avatar-voice-bars"
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="chat-avatar-copy">
        <p className="chat-avatar-state-detail">
          {presentation.detail}
        </p>

        {liveConversationAvailable &&
          onLiveConversationChange && (
            <div className="chat-live-conversation-control">
              <button
                className={[
                  'chat-live-conversation-toggle',
                  liveConversationEnabled
                    ? 'chat-live-conversation-toggle-active'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                type="button"
                aria-pressed={
                  liveConversationEnabled
                }
                onClick={() =>
                  onLiveConversationChange(
                    !liveConversationEnabled,
                  )
                }
              >
                <span aria-hidden="true">
                  {liveConversationEnabled
                    ? '●'
                    : '○'}
                </span>
                שיחה חיה{' '}
                {liveConversationEnabled
                  ? 'פעילה'
                  : 'כבויה'}
              </button>

              <small>
                כשהמצב פעיל, תשובה חדשה מפיקה קול אישי
                ושידור פנים חי של D‑ID. במקרה של תקלה
                האווטאר המקומי ממשיך אוטומטית.
              </small>
            </div>
          )}

        {hasVideo && !isVideoOpen && (
          <button
            className="chat-avatar-open-video"
            type="button"
            disabled={isSpeaking}
            onClick={() =>
              setOpenedVideoUrl(
                avatarState.videoUrl,
              )
            }
          >
            פתיחת הווידאו המוכן
            <small>
              הווידאו לא יופעל אוטומטית
            </small>
          </button>
        )}

        {hasVideo && isVideoOpen && (
          <button
            className="chat-avatar-close-video"
            type="button"
            onClick={() =>
              setOpenedVideoUrl('')
            }
          >
            חזרה לאווטאר החי
          </button>
        )}

        <p className="chat-avatar-disclosure">
          זהו אווטאר AI מסוגנן, לא האדם
          עצמו ולא וידאו אמיתי שלו.
        </p>

        {avatarState.error && (
          <p
            className="chat-avatar-error"
            role="alert"
          >
            {avatarState.error}
          </p>
        )}

        {!avatarState.error &&
          realtimeAvatar?.error && (
            <p
              className="chat-avatar-error"
              role="alert"
            >
              {realtimeAvatar.error}
            </p>
          )}
      </div>
    </section>
  )
}

export default ChatAvatarStage
