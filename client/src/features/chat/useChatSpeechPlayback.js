import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  getMemoryChatAvatarJobStatus,
  getMemoryChatAvatarVideo,
  getMemoryChatMessageAvatarSpeech,
  getMemoryChatMessageRealtimeAvatarSpeech,
  getMemoryChatMessageRealtimeAvatarSpeechChunk,
  getMemoryChatMessageSpeech,
  releaseMemoryChatRealtimeAvatarAudio,
} from '../../api/chatApi.js'
import {
  getRealtimeSpeechStrategy,
} from './realtimeSpeechStrategy.js'

const initialSpeechState = {
  messageId: null,
  status: 'idle',
  error: '',
}

const initialAvatarState = {
  messageId: null,
  status: 'idle',
  error: '',
  videoUrl: '',
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}

function getAvatarErrorMessage(error) {
  const messages = {
    DID_VIDEO_DOWNLOAD_BLOCKED:
      'הווידאו נוצר אצל D‑ID, אך לא היה אפשר להוריד אותו. התמונה המקומית נשארת פעילה.',
    DID_AUTHENTICATION_FAILED:
      'מפתח D‑ID נדחה. הקול ימשיך לעבוד ללא וידאו.',
    DID_BILLING_REQUIRED:
      'אין כרגע יתרה או הרשאה להפקת D‑ID. הקול נשאר זמין.',
    DID_RATE_LIMITED:
      'D‑ID עמוס כרגע. אפשר לנסות שוב בעוד כמה דקות.',
    DID_MEDIA_REJECTED:
      'D‑ID לא הצליח לעבד את התמונה או הקול.',
    DID_AVATAR_JOB_EXPIRED:
      'הווידאו הזמני כבר נמחק. אפשר ליצור חדש.',
  }

  return (
    messages[error?.code] ??
    'לא הצלחנו ליצור את וידאו האווטאר. הקול והתמונה המקומית עדיין זמינים.'
  )
}

export function useChatSpeechPlayback({
  memoryId,
  conversationId,
  runAuthenticatedRequest,
  getErrorMessage,
  realtimeAvatar,
}) {
  const [speechState, setSpeechState] =
    useState(initialSpeechState)
  const [avatarState, setAvatarState] =
    useState(initialAvatarState)

  const audioRef = useRef(null)
  const audioUrlRef = useRef(null)
  const videoUrlRef = useRef(null)
  const playbackSequenceRef = useRef(0)
  const avatarSequenceRef = useRef(0)
  const realtimeReleaseRef = useRef(
    new Set(),
  )
  const directRealtimeMessageRef =
    useRef(null)
  const isMountedRef = useRef(true)

  const registerRealtimeAudioRelease =
    useCallback(
      (realtimeReleaseToken) => {
        let active = true

        const release = async () => {
          if (!active) {
            return
          }

          active = false
          realtimeReleaseRef.current.delete(
            release,
          )

          await runAuthenticatedRequest(
            (accessToken) =>
              releaseMemoryChatRealtimeAvatarAudio(
                accessToken,
                memoryId,
                realtimeReleaseToken,
              ),
          )
        }

        realtimeReleaseRef.current.add(
          release,
        )

        return release
      },
      [memoryId, runAuthenticatedRequest],
    )

  const releaseRealtimeAudio = useCallback(
    () => {
      const releases = [
        ...realtimeReleaseRef.current,
      ]

      realtimeReleaseRef.current.clear()

      for (const release of releases) {
        void release().catch(() => {})
      }
    },
    [],
  )

  const releaseCurrentAudio = useCallback(() => {
    const audio = audioRef.current

    if (audio) {
      audio.onended = null
      audio.onerror = null
      audio.onpause = null
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }

    audioRef.current = null

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
  }, [])

  const releaseAudio = useCallback(() => {
    releaseCurrentAudio()
    releaseRealtimeAudio()
  }, [
    releaseCurrentAudio,
    releaseRealtimeAudio,
  ])

  const releaseVideo = useCallback(() => {
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current)
      videoUrlRef.current = null
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      playbackSequenceRef.current += 1
      avatarSequenceRef.current += 1
      directRealtimeMessageRef.current = null
      releaseAudio()
      releaseVideo()
    }
  }, [releaseAudio, releaseVideo])

  const stopSpeech = useCallback(() => {
    playbackSequenceRef.current += 1
    directRealtimeMessageRef.current = null
    realtimeAvatar?.stop?.()
    releaseAudio()

    if (isMountedRef.current) {
      setSpeechState(initialSpeechState)
      setAvatarState(initialAvatarState)
    }
  }, [realtimeAvatar, releaseAudio])

  useEffect(() => {
    const directMessage =
      directRealtimeMessageRef.current

    if (
      !directMessage ||
      realtimeAvatar?.status ===
        'speaking' ||
      realtimeAvatar?.status ===
        'connecting'
    ) {
      return
    }

    if (
      playbackSequenceRef.current !==
      directMessage.sequence
    ) {
      directRealtimeMessageRef.current = null
      return
    }

    if (realtimeAvatar?.status === 'ready') {
      void Promise.resolve().then(() => {
        if (
          !isMountedRef.current ||
          directRealtimeMessageRef.current !==
            directMessage
        ) {
          return
        }

        directRealtimeMessageRef.current = null
        setSpeechState(initialSpeechState)
        setAvatarState(initialAvatarState)
      })
      return
    }

    if (
      realtimeAvatar?.status === 'error' ||
      realtimeAvatar?.status ===
        'unavailable'
    ) {
      void Promise.resolve().then(() => {
        if (
          !isMountedRef.current ||
          directRealtimeMessageRef.current !==
            directMessage
        ) {
          return
        }

        directRealtimeMessageRef.current = null
        setSpeechState({
          messageId:
            directMessage.messageId,
          status: 'error',
          error:
            'השידור החי הופסק לפני סיום התשובה.',
        })
        setAvatarState({
          messageId:
            directMessage.messageId,
          status: 'realtime-error',
          error:
            'השידור החי הופסק. אפשר לנסות שוב והמערכת תשתמש במסלול הגיבוי.',
          videoUrl: '',
        })
      })
    }
  }, [realtimeAvatar?.status])

  const pollAvatarJob = useCallback(
    async ({ avatarJobId, messageId, sequence }) => {
      for (let attempt = 0; attempt < 130; attempt += 1) {
        if (
          !isMountedRef.current ||
          avatarSequenceRef.current !== sequence
        ) {
          return
        }

        const job = await runAuthenticatedRequest(
          (accessToken) =>
            getMemoryChatAvatarJobStatus(
              accessToken,
              memoryId,
              avatarJobId,
            ),
        )

        if (job?.status === 'failed') {
          const error = new Error(
            job.errorMessage ??
              'Avatar generation failed.',
          )
          error.code = job.errorCode
          throw error
        }

        if (job?.status === 'ready') {
          const videoBlob =
            await runAuthenticatedRequest(
              (accessToken) =>
                getMemoryChatAvatarVideo(
                  accessToken,
                  memoryId,
                  avatarJobId,
                ),
            )

          if (
            !isMountedRef.current ||
            avatarSequenceRef.current !== sequence
          ) {
            return
          }

          releaseVideo()
          const videoUrl =
            URL.createObjectURL(videoBlob)
          videoUrlRef.current = videoUrl

          setAvatarState({
            messageId,
            status: 'ready',
            error: '',
            videoUrl,
          })
          return
        }

        await wait(2000)
      }

      const timeoutError = new Error(
        'Avatar generation timed out.',
      )
      timeoutError.code = 'DID_POLL_TIMEOUT'
      throw timeoutError
    },
    [memoryId, releaseVideo, runAuthenticatedRequest],
  )

  const playProgressiveRealtimeSpeech =
    useCallback(
      async ({
        messageId,
        playbackSequence,
      }) => {
        const isCurrentSequence = () =>
          isMountedRef.current &&
          playbackSequenceRef.current ===
            playbackSequence

        const requestChunk = async (
          chunkIndex,
        ) => {
          const result =
            await runAuthenticatedRequest(
              (accessToken) =>
                getMemoryChatMessageRealtimeAvatarSpeechChunk(
                  accessToken,
                  memoryId,
                  conversationId,
                  messageId,
                  chunkIndex,
                ),
            )

          const release =
            registerRealtimeAudioRelease(
              result.realtimeReleaseToken,
            )

          if (
            result.chunkIndex !==
              chunkIndex ||
            result.chunkCount > 6
          ) {
            await release().catch(() => {})
            const error = new Error(
              'The progressive speech response was invalid.',
            )
            error.code =
              'DID_REALTIME_INVALID_RESPONSE'
            throw error
          }

          if (!isCurrentSequence()) {
            await release().catch(() => {})
            return null
          }

          return {
            ...result,
            release,
          }
        }

        const requestChunkOutcome = async (
          chunkIndex,
        ) => {
          try {
            return {
              value:
                await requestChunk(chunkIndex),
              error: null,
            }
          } catch (error) {
            return {
              value: null,
              error,
            }
          }
        }

        const firstOutcome =
          await requestChunkOutcome(0)

        if (firstOutcome.error) {
          firstOutcome.error
            .progressiveSpeechFallback = true
          throw firstOutcome.error
        }

        let current = firstOutcome.value

        if (!current) {
          return false
        }

        while (current) {
          if (!isCurrentSequence()) {
            await current.release()
              .catch(() => {})
            return false
          }

          const nextChunkIndex =
            current.chunkIndex + 1
          const nextOutcomePromise =
            nextChunkIndex <
            current.chunkCount
              ? requestChunkOutcome(
                  nextChunkIndex,
                )
              : null

          let waitForAvatarEnd =
            Promise.resolve()

          try {
            await realtimeAvatar.speak(
              current.realtimeAudioUrl,
            )

            waitForAvatarEnd =
              realtimeAvatar
                .waitForSpeechEnd?.() ??
              Promise.resolve()

            if (isCurrentSequence()) {
              setAvatarState({
                messageId,
                status:
                  'realtime-speaking',
                error: '',
                videoUrl: '',
              })
            }
          } catch {
            if (isCurrentSequence()) {
              setAvatarState({
                messageId,
                status:
                  'realtime-error',
                error:
                  'השידור החי לא התחיל; הקול ממשיך עם האווטאר המקומי.',
                videoUrl: '',
              })
            }
          }

          const audioUrl =
            URL.createObjectURL(
              current.audioBlob,
            )
          const audio = new Audio(audioUrl)

          audioUrlRef.current = audioUrl
          audioRef.current = audio

          const audioEnded = new Promise(
            (resolve, reject) => {
              audio.onended = resolve
              audio.onpause = resolve
              audio.onerror = () => {
                reject(
                  new Error(
                    'The speech audio could not be played.',
                  ),
                )
              }
            },
          )

          try {
            await audio.play()
          } catch (error) {
            releaseCurrentAudio()
            await current.release()
              .catch(() => {})
            throw error
          }

          if (!isCurrentSequence()) {
            releaseCurrentAudio()
            await current.release()
              .catch(() => {})
            return false
          }

          setSpeechState({
            messageId,
            status: 'playing',
            error: '',
          })

          await Promise.all([
            audioEnded,
            waitForAvatarEnd,
          ])

          releaseCurrentAudio()
          await current.release()
            .catch(() => {})

          if (!isCurrentSequence()) {
            return false
          }

          if (!nextOutcomePromise) {
            current = null
            continue
          }

          const nextOutcome =
            await nextOutcomePromise

          if (nextOutcome.error) {
            throw nextOutcome.error
          }

          current = nextOutcome.value
        }

        if (isCurrentSequence()) {
          setSpeechState(initialSpeechState)
          setAvatarState(initialAvatarState)
        }

        return true
      },
      [
        conversationId,
        memoryId,
        realtimeAvatar,
        registerRealtimeAudioRelease,
        releaseCurrentAudio,
        runAuthenticatedRequest,
      ],
    )

  const toggleSpeech = useCallback(
    async (
      messageId,
      {
        requestAvatarVideo = false,
        requestRealtimeAvatar = false,
        realtimeText = '',
      } = {},
    ) => {
      const isCurrentMessage =
        speechState.messageId === messageId
      const isActive =
        speechState.status === 'loading' ||
        speechState.status === 'playing'

      if (isCurrentMessage && isActive) {
        stopSpeech()
        return
      }

      if (
        isCurrentMessage &&
        speechState.status === 'ready' &&
        audioRef.current
      ) {
        try {
          await audioRef.current.play()

          if (isMountedRef.current) {
            setSpeechState({
              messageId,
              status: 'playing',
              error: '',
            })
          }
        } catch {
          if (isMountedRef.current) {
            setSpeechState({
              messageId,
              status: 'ready',
              error:
                'הקול מוכן, אך הדפדפן עדיין מונע את הפעלתו. נסו ללחוץ שוב.',
            })
          }
        }

        return
      }

      if (!memoryId || !conversationId) {
        return
      }

      playbackSequenceRef.current += 1
      const playbackSequence =
        playbackSequenceRef.current

      realtimeAvatar?.stop?.()
      releaseAudio()
      setSpeechState({
        messageId,
        status: 'loading',
        error: '',
      })

      avatarSequenceRef.current += 1
      const avatarSequence =
        avatarSequenceRef.current

      releaseVideo()

      if (requestRealtimeAvatar) {
        setAvatarState({
          messageId,
          status: 'realtime-preparing',
          error: '',
          videoUrl: '',
        })
      } else if (requestAvatarVideo) {
        setAvatarState({
          messageId,
          status: 'preparing',
          error: '',
          videoUrl: '',
        })
      } else {
        setAvatarState(initialAvatarState)
      }

      try {
        const realtimeStrategy =
          getRealtimeSpeechStrategy({
            requestRealtimeAvatar,
            realtimeText,
            textSpeechAvailable:
              realtimeAvatar
                ?.textSpeechAvailable ===
              true,
          })

        if (
          realtimeStrategy.mode ===
          'direct-text'
        ) {
          try {
            await realtimeAvatar.speakText(
              realtimeStrategy.text,
            )

            if (
              !isMountedRef.current ||
              playbackSequenceRef.current !==
                playbackSequence
            ) {
              return
            }

            directRealtimeMessageRef.current = {
              messageId,
              sequence: playbackSequence,
            }

            setSpeechState({
              messageId,
              status: 'playing',
              error: '',
            })
            setAvatarState({
              messageId,
              status:
                'realtime-speaking',
              error: '',
              videoUrl: '',
            })

            return
          } catch {
            if (
              !isMountedRef.current ||
              playbackSequenceRef.current !==
                playbackSequence
            ) {
              return
            }

            setAvatarState({
              messageId,
              status:
                'realtime-preparing',
              error: '',
              videoUrl: '',
            })
          }
        }

        if (requestRealtimeAvatar) {
          try {
            await playProgressiveRealtimeSpeech({
              messageId,
              playbackSequence,
            })

            return
          } catch (error) {
            if (
              !error
                ?.progressiveSpeechFallback
            ) {
              throw error
            }

            if (
              !isMountedRef.current ||
              playbackSequenceRef.current !==
                playbackSequence
            ) {
              return
            }

            setAvatarState({
              messageId,
              status:
                'realtime-preparing',
              error: '',
              videoUrl: '',
            })
          }
        }

        const result =
          await runAuthenticatedRequest(
            (accessToken) =>
              requestRealtimeAvatar
                ? getMemoryChatMessageRealtimeAvatarSpeech(
                    accessToken,
                    memoryId,
                    conversationId,
                    messageId,
                  )
                : requestAvatarVideo
                ? getMemoryChatMessageAvatarSpeech(
                    accessToken,
                    memoryId,
                    conversationId,
                    messageId,
                  )
                : getMemoryChatMessageSpeech(
                    accessToken,
                    memoryId,
                    conversationId,
                    messageId,
                  ),
          )

        const audioBlob =
          requestAvatarVideo ||
          requestRealtimeAvatar
          ? result.audioBlob
          : result

        if (
          !isMountedRef.current ||
          playbackSequenceRef.current !==
            playbackSequence
        ) {
          return
        }

        if (requestAvatarVideo) {
          pollAvatarJob({
            avatarJobId: result.avatarJobId,
            messageId,
            sequence: avatarSequence,
          }).catch((error) => {
            if (
              !isMountedRef.current ||
              avatarSequenceRef.current !==
                avatarSequence
            ) {
              return
            }

            setAvatarState({
              messageId,
              status: 'error',
              error:
                getAvatarErrorMessage(error),
              videoUrl: '',
            })
          })
        }

        if (requestRealtimeAvatar) {
          registerRealtimeAudioRelease(
            result.realtimeReleaseToken,
          )

          try {
            await realtimeAvatar.speak(
              result.realtimeAudioUrl,
            )

            if (
              isMountedRef.current &&
              playbackSequenceRef.current ===
                playbackSequence
            ) {
              setAvatarState({
                messageId,
                status:
                  'realtime-speaking',
                error: '',
                videoUrl: '',
              })
            }
          } catch {
            if (
              isMountedRef.current &&
              playbackSequenceRef.current ===
                playbackSequence
            ) {
              setAvatarState({
                messageId,
                status: 'realtime-error',
                error:
                  'השידור החי לא התחיל; הקול ממשיך עם האווטאר המקומי.',
                videoUrl: '',
              })
            }
          }
        }

        const audioUrl =
          URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)

        audioUrlRef.current = audioUrl
        audioRef.current = audio

        audio.onended = () => {
          if (audioRef.current !== audio) {
            return
          }

          releaseAudio()

          if (isMountedRef.current) {
            setSpeechState(initialSpeechState)

            if (requestRealtimeAvatar) {
              setAvatarState(
                initialAvatarState,
              )
            }
          }
        }

        audio.onerror = () => {
          if (audioRef.current !== audio) {
            return
          }

          releaseAudio()

          if (isMountedRef.current) {
            setSpeechState({
              messageId,
              status: 'error',
              error:
                'לא הצלחנו להשמיע את קובץ האודיו.',
            })

            if (requestRealtimeAvatar) {
              setAvatarState(
                initialAvatarState,
              )
            }
          }
        }

        try {
          await audio.play()
        } catch (error) {
          if (
            error?.name ===
            'NotAllowedError'
          ) {
            if (isMountedRef.current) {
              setSpeechState({
                messageId,
                status: 'ready',
                error:
                  'הקול מוכן. הדפדפן מנע הפעלה אוטומטית, ולכן יש ללחוץ על כפתור ההשמעה.',
              })
            }

            return
          }

          throw error
        }

        if (
          !isMountedRef.current ||
          playbackSequenceRef.current !==
            playbackSequence ||
          audioRef.current !== audio
        ) {
          releaseAudio()
          return
        }

        setSpeechState({
          messageId,
          status: 'playing',
          error: '',
        })
      } catch (error) {
        if (
          !isMountedRef.current ||
          playbackSequenceRef.current !==
            playbackSequence
        ) {
          return
        }

        releaseAudio()
        setSpeechState({
          messageId,
          status: 'error',
          error: getErrorMessage(error),
        })

        if (
          (requestAvatarVideo ||
            requestRealtimeAvatar) &&
          avatarSequenceRef.current ===
            avatarSequence
        ) {
          setAvatarState({
            messageId,
            status: 'error',
            error: getAvatarErrorMessage(error),
            videoUrl: '',
          })
        }
      }
    },
    [
      conversationId,
      getErrorMessage,
      memoryId,
      playProgressiveRealtimeSpeech,
      pollAvatarJob,
      realtimeAvatar,
      registerRealtimeAudioRelease,
      releaseAudio,
      releaseVideo,
      runAuthenticatedRequest,
      speechState.messageId,
      speechState.status,
      stopSpeech,
    ],
  )

  return {
    speechState,
    avatarState,
    toggleSpeech,
    stopSpeech,
  }
}
