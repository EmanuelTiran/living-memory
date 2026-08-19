import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  transcribeMemoryChatVoiceInput,
} from '../../api/chatApi.js'

const RECORDING_MIME_TYPE_CANDIDATES =
  Object.freeze([
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ])

function getBaseMimeType(mimeType) {
  return mimeType
    .split(';')[0]
    .trim()
    .toLowerCase()
}

function getFileName(mimeType) {
  const extension =
    mimeType === 'audio/mp4'
      ? 'm4a'
      : 'webm'

  return `chat-question.${extension}`
}

function getBrowserErrorMessage(error) {
  if (
    error?.name === 'NotAllowedError' ||
    error?.name === 'SecurityError'
  ) {
    return 'הדפדפן לא קיבל הרשאה להשתמש במיקרופון. יש לאשר את ההרשאה ולנסות שוב.'
  }

  if (
    error?.name === 'NotFoundError' ||
    error?.name === 'DevicesNotFoundError'
  ) {
    return 'לא נמצא מיקרופון זמין במכשיר.'
  }

  return 'לא הצלחנו להתחיל את ההקלטה מהמיקרופון.'
}

function findSupportedMimeType() {
  if (
    typeof MediaRecorder ===
      'undefined' ||
    typeof MediaRecorder
      .isTypeSupported !== 'function'
  ) {
    return null
  }

  return (
    RECORDING_MIME_TYPE_CANDIDATES.find(
      (mimeType) =>
        MediaRecorder.isTypeSupported(
          mimeType,
        ),
    ) ?? null
  )
}

export function useChatVoiceInput({
  active,
  maxDurationSeconds = 60,
  maxFileSizeBytes =
    10 * 1024 * 1024,
  memoryId,
  runAuthenticatedRequest,
  onTranscript,
  getErrorMessage,
}) {
  const [phase, setPhase] =
    useState('idle')
  const [elapsedSeconds, setElapsedSeconds] =
    useState(0)
  const [statusMessage, setStatusMessage] =
    useState('')
  const [errorMessage, setErrorMessage] =
    useState('')

  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const canceledRef = useRef(false)
  const intervalRef = useRef(null)
  const timeoutRef = useRef(null)
  const mountedRef = useRef(true)

  const supportedMimeType =
    findSupportedMimeType()

  const browserSupported =
    Boolean(
      supportedMimeType &&
        navigator.mediaDevices
          ?.getUserMedia,
    )

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(
        intervalRef.current,
      )
      intervalRef.current = null
    }

    if (timeoutRef.current) {
      window.clearTimeout(
        timeoutRef.current,
      )
      timeoutRef.current = null
    }
  }, [])

  const stopStream = useCallback(() => {
    streamRef.current
      ?.getTracks()
      .forEach((track) => track.stop())

    streamRef.current = null
  }, [])

  const clearFeedback = useCallback(() => {
    setStatusMessage('')
    setErrorMessage('')
  }, [])

  const cancelRecording = useCallback(() => {
    canceledRef.current = true
    clearTimers()

    const recorder = recorderRef.current

    if (
      recorder &&
      recorder.state !== 'inactive'
    ) {
      recorder.stop()
    } else {
      stopStream()
      chunksRef.current = []
    }

    if (mountedRef.current) {
      setPhase('idle')
      setElapsedSeconds(0)
      setStatusMessage('')
      setErrorMessage('')
    }
  }, [clearTimers, stopStream])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current

    if (
      !recorder ||
      recorder.state === 'inactive'
    ) {
      return
    }

    clearTimers()
    setPhase('transcribing')
    setStatusMessage(
      'מתמללים את ההקלטה לעברית...',
    )
    recorder.stop()
  }, [clearTimers])

  const startRecording = useCallback(
    async () => {
      if (
        !active ||
        !browserSupported ||
        phase !== 'idle'
      ) {
        return
      }

      setPhase('requesting')
      setElapsedSeconds(0)
      setStatusMessage('')
      setErrorMessage('')
      canceledRef.current = false
      chunksRef.current = []

      let stream

      try {
        stream =
          await navigator.mediaDevices
            .getUserMedia({
              audio: true,
              video: false,
            })

        if (!mountedRef.current) {
          stream
            .getTracks()
            .forEach((track) =>
              track.stop(),
            )
          return
        }

        if (canceledRef.current) {
          stream
            .getTracks()
            .forEach((track) =>
              track.stop(),
            )
          canceledRef.current = false
          setPhase('idle')
          return
        }

        streamRef.current = stream

        const recorder =
          new MediaRecorder(stream, {
            mimeType:
              supportedMimeType,
          })

        recorderRef.current = recorder

        recorder.addEventListener(
          'dataavailable',
          (event) => {
            if (event.data.size > 0) {
              chunksRef.current.push(
                event.data,
              )
            }
          },
        )

        recorder.addEventListener(
          'stop',
          async () => {
            clearTimers()
            stopStream()
            recorderRef.current = null

            const chunks =
              chunksRef.current
            chunksRef.current = []

            if (canceledRef.current) {
              canceledRef.current = false
              return
            }

            const mimeType =
              getBaseMimeType(
                recorder.mimeType ||
                  supportedMimeType,
              )

            const audioBlob = new Blob(
              chunks,
              {
                type: mimeType,
              },
            )

            if (!mountedRef.current) {
              return
            }

            if (audioBlob.size === 0) {
              setPhase('idle')
              setStatusMessage('')
              setErrorMessage(
                'לא נקלט קול בהקלטה. נסו שוב ודברו לאחר שהמונה מתחיל.',
              )
              return
            }

            if (
              audioBlob.size >
              maxFileSizeBytes
            ) {
              setPhase('idle')
              setStatusMessage('')
              setErrorMessage(
                'ההקלטה גדולה מדי. נסו שאלה קצרה יותר.',
              )
              return
            }

            try {
              const transcript =
                await runAuthenticatedRequest(
                  (accessToken) =>
                    transcribeMemoryChatVoiceInput(
                      accessToken,
                      memoryId,
                      audioBlob,
                      getFileName(mimeType),
                    ),
                )

              if (!mountedRef.current) {
                return
              }

              onTranscript(transcript.text)
              setErrorMessage('')
              setStatusMessage(
                'התמלול הוכנס לשדה. בדקו וערכו אותו לפני שליחה.',
              )
            } catch (error) {
              if (mountedRef.current) {
                setStatusMessage('')
                setErrorMessage(
                  getErrorMessage(error),
                )
              }
            } finally {
              if (mountedRef.current) {
                setPhase('idle')
                setElapsedSeconds(0)
              }
            }
          },
          {
            once: true,
          },
        )

        recorder.start(1000)
        setPhase('recording')
        setStatusMessage(
          'מקליטים. דברו בעברית ולחצו על עצירה בסיום.',
        )

        intervalRef.current =
          window.setInterval(() => {
            setElapsedSeconds(
              (current) =>
                Math.min(
                  current + 1,
                  maxDurationSeconds,
                ),
            )
          }, 1000)

        timeoutRef.current =
          window.setTimeout(() => {
            if (
              recorder.state !==
              'inactive'
            ) {
              setPhase('transcribing')
              setStatusMessage(
                'ההקלטה נעצרה לאחר דקה. מתמללים לעברית...',
              )
              recorder.stop()
            }
          }, maxDurationSeconds * 1000)
      } catch (error) {
        stream
          ?.getTracks()
          .forEach((track) =>
            track.stop(),
          )
        stopStream()

        if (mountedRef.current) {
          setPhase('idle')
          setStatusMessage('')
          setErrorMessage(
            getBrowserErrorMessage(error),
          )
        }
      }
    },
    [
      active,
      browserSupported,
      clearTimers,
      getErrorMessage,
      maxDurationSeconds,
      maxFileSizeBytes,
      memoryId,
      onTranscript,
      phase,
      runAuthenticatedRequest,
      stopStream,
      supportedMimeType,
    ],
  )

  useEffect(() => {
    if (!active) {
      cancelRecording()
    }
  }, [active, cancelRecording])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      canceledRef.current = true
      clearTimers()

      if (
        recorderRef.current &&
        recorderRef.current.state !==
          'inactive'
      ) {
        recorderRef.current.stop()
      }

      stopStream()
    }
  }, [clearTimers, stopStream])

  return {
    phase,
    elapsedSeconds,
    statusMessage,
    errorMessage,
    browserSupported,
    isBusy: phase !== 'idle',
    startRecording,
    stopRecording,
    cancelRecording,
    clearFeedback,
  }
}
