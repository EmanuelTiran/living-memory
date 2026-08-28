import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { ApiError } from '../../api/authApi.js'
import {
  createMemoryRecording,
  requestMemoryRecordingTranscription,
  uploadMemoryRecordingFile,
} from '../../api/recordingApi.js'
import './GuidedInterviewRecorder.css'

const MAX_RECORDING_SIZE_BYTES =
  25 * 1024 * 1024

const MAX_RECORDING_DURATION_SECONDS =
  5 * 60

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

function getFileExtension(mimeType) {
  return mimeType === 'audio/mp4'
    ? 'm4a'
    : 'webm'
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(
    totalSeconds / 60,
  )

  const seconds = String(
    totalSeconds % 60,
  ).padStart(2, '0')

  return `${minutes}:${seconds}`
}

function getBrowserErrorMessage(error) {
  if (
    error?.name === 'NotAllowedError' ||
    error?.name === 'SecurityError'
  ) {
    return 'הדפדפן לא קיבל הרשאה להשתמש במיקרופון. אשרו את ההרשאה ונסו שוב.'
  }

  if (
    error?.name === 'NotFoundError' ||
    error?.name ===
      'DevicesNotFoundError'
  ) {
    return 'לא נמצא מיקרופון זמין במכשיר.'
  }

  return 'לא הצלחנו להתחיל את ההקלטה מהמיקרופון.'
}

function getSaveErrorMessage(error) {
  if (!(error instanceof ApiError)) {
    return 'לא הצלחנו לשמור את התשובה הקולית.'
  }

  const messages = {
    INTERVIEW_PROMPT_NOT_FOUND:
      'השאלה אינה זמינה יותר. עברו לשאלה אחרת ונסו שוב.',
    FAMILY_QUESTION_NOT_FOUND:
      'השאלה מהמשפחה אינה זמינה יותר.',
    MEMORY_NOT_FOUND:
      'הזיכרון לא נמצא או שאין לכם הרשאה לשמור בו הקלטה.',
    VALIDATION_ERROR:
      'פרטי ההקלטה אינם תקינים.',
    INVALID_RECORDING_CONTENT:
      'הדפדפן יצר קובץ שמע שאינו נתמך. נסו דפדפן מעודכן או העלאת קובץ.',
    RECORDING_FILE_MISMATCH:
      'קובץ ההקלטה אינו תואם לפרטים שנשמרו.',
    RECORDING_TRANSCRIPTION_UNAVAILABLE:
      'ההקלטה נשמרה, אך לא ניתן להתחיל את התמלול כרגע.',
    AI_SERVICE_NOT_CONFIGURED:
      'ההקלטה נשמרה, אך שירות התמלול אינו מוגדר כרגע.',
    AI_SERVICE_TIMEOUT:
      'ההקלטה נשמרה, אך שירות התמלול לא השיב בזמן.',
    AI_SERVICE_RATE_LIMITED:
      'ההקלטה נשמרה, אך שירות התמלול עמוס כרגע.',
    AI_SERVICE_UNAVAILABLE:
      'ההקלטה נשמרה, אך שירות התמלול אינו זמין כרגע.',
    AUTHENTICATION_REQUIRED:
      'החיבור לחשבון הסתיים. יש להתחבר מחדש.',
    NETWORK_ERROR:
      'לא הצלחנו להתחבר לשרת.',
  }

  return (
    messages[error.code] ??
    'לא הצלחנו להשלים את שמירת התשובה הקולית.'
  )
}

function notifyRecordingsUpdated(memoryId) {
  window.dispatchEvent(
    new CustomEvent(
      'living-memory:recordings-updated',
      {
        detail: {
          memoryId,
        },
      },
    ),
  )
}

function GuidedInterviewRecorder({
  memoryId,
  question,
  familyQuestionId = '',
  subjectName,
  runAuthenticatedRequest,
  onBusyChange,
  onAnswerStored = () => {},
}) {
  const [phase, setPhase] =
    useState('idle')

  const [elapsedSeconds, setElapsedSeconds] =
    useState(0)

  const [recordedFile, setRecordedFile] =
    useState(null)

  const [recordingDurationMs, setRecordingDurationMs] =
    useState(0)

  const [previewUrl, setPreviewUrl] =
    useState('')

  const [consentBasis, setConsentBasis] =
    useState('subject_consent')

  const [storageConsent, setStorageConsent] =
    useState(false)

  const [sourceConsent, setSourceConsent] =
    useState(false)

  const [errorMessage, setErrorMessage] =
    useState('')

  const [successMessage, setSuccessMessage] =
    useState('')

  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const intervalRef = useRef(null)
  const timeoutRef = useRef(null)
  const startedAtRef = useRef(0)
  const canceledRef = useRef(false)
  const mountedRef = useRef(true)
  const previewUrlRef = useRef('')

  const supportedMimeType =
    findSupportedMimeType()

  const browserSupported = Boolean(
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

  const replacePreviewUrl = useCallback(
    (nextUrl) => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(
          previewUrlRef.current,
        )
      }

      previewUrlRef.current = nextUrl
      setPreviewUrl(nextUrl)
    },
    [],
  )

  const discardRecording = useCallback(() => {
    replacePreviewUrl('')
    setRecordedFile(null)
    setRecordingDurationMs(0)
    setElapsedSeconds(0)
    setErrorMessage('')
    setSuccessMessage('')
    setPhase('idle')
    onBusyChange(false)
  }, [
    onBusyChange,
    replacePreviewUrl,
  ])

  const cancelActiveRecording = useCallback(() => {
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
      discardRecording()
    }
  }, [
    clearTimers,
    discardRecording,
    stopStream,
  ])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current

    if (
      !recorder ||
      recorder.state === 'inactive'
    ) {
      return
    }

    clearTimers()
    setPhase('preparing')
    recorder.stop()
  }, [clearTimers])

  const startRecording = useCallback(
    async () => {
      if (
        !browserSupported ||
        phase !== 'idle'
      ) {
        return
      }

      setPhase('requesting')
      setElapsedSeconds(0)
      setErrorMessage('')
      setSuccessMessage('')
      onBusyChange(true)
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
          () => {
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

            const audioBlob =
              new Blob(chunks, {
                type: mimeType,
              })

            if (!mountedRef.current) {
              return
            }

            if (audioBlob.size === 0) {
              setPhase('idle')
              setElapsedSeconds(0)
              setErrorMessage(
                'לא נקלט קול. נסו שוב ודברו לאחר שהמונה מתחיל.',
              )
              onBusyChange(false)
              return
            }

            if (
              audioBlob.size >
              MAX_RECORDING_SIZE_BYTES
            ) {
              setPhase('idle')
              setElapsedSeconds(0)
              setErrorMessage(
                'ההקלטה גדולה מדי. נסו תשובה קצרה יותר.',
              )
              onBusyChange(false)
              return
            }

            const durationMs = Math.max(
              1,
              Date.now() -
                startedAtRef.current,
            )

            const extension =
              getFileExtension(mimeType)

            const file = new File(
              [audioBlob],
              `guided-${question.key}-${Date.now()}.${extension}`,
              {
                type: mimeType,
                lastModified: Date.now(),
              },
            )

            setRecordedFile(file)
            setRecordingDurationMs(
              durationMs,
            )
            setElapsedSeconds(
              Math.max(
                1,
                Math.round(
                  durationMs / 1000,
                ),
              ),
            )
            replacePreviewUrl(
              URL.createObjectURL(file),
            )
            setPhase('review')
          },
          {
            once: true,
          },
        )

        startedAtRef.current = Date.now()
        recorder.start(1000)
        setPhase('recording')

        intervalRef.current =
          window.setInterval(() => {
            setElapsedSeconds(
              (current) =>
                Math.min(
                  current + 1,
                  MAX_RECORDING_DURATION_SECONDS,
                ),
            )
          }, 1000)

        timeoutRef.current =
          window.setTimeout(() => {
            if (
              recorder.state !==
              'inactive'
            ) {
              setPhase('preparing')
              recorder.stop()
            }
          }, MAX_RECORDING_DURATION_SECONDS * 1000)
      } catch (error) {
        stream
          ?.getTracks()
          .forEach((track) =>
            track.stop(),
          )
        stopStream()

        if (mountedRef.current) {
          setPhase('idle')
          setErrorMessage(
            getBrowserErrorMessage(error),
          )
          onBusyChange(false)
        }
      }
    },
    [
      browserSupported,
      clearTimers,
      onBusyChange,
      phase,
      question.key,
      replacePreviewUrl,
      stopStream,
      supportedMimeType,
    ],
  )

  async function saveRecording() {
    setErrorMessage('')
    setSuccessMessage('')

    if (!recordedFile) {
      setErrorMessage(
        'הקליטו תשובה לפני השמירה.',
      )
      return
    }

    if (!storageConsent) {
      setErrorMessage(
        'נדרש אישור מפורש לשמירה ולתמלול.',
      )
      return
    }

    if (!sourceConsent) {
      setErrorMessage(
        'נדרש אישור נפרד לשימוש בתמלול כמקור, לאחר שתבדקו ותאשרו אותו.',
      )
      return
    }

    setPhase('saving')
    onBusyChange(true)

    let metadataWasCreated = false
    let recordingWasStored = false

    try {
      const displayName =
        `תשובה: ${question.question}`
          .slice(0, 120)

      const promptSource =
        familyQuestionId
          ? {
              familyQuestionId,
            }
          : {
              interviewPrompt: {
                questionKey:
                  question.key,
              },
            }

      const recording =
        await runAuthenticatedRequest(
          (accessToken) =>
            createMemoryRecording(
              accessToken,
              memoryId,
              {
                displayName,
                originalFileName:
                  recordedFile.name,
                mimeType:
                  recordedFile.type,
                sizeBytes:
                  recordedFile.size,
                durationMs:
                  recordingDurationMs,
                languageCode: 'he',
                ...promptSource,
                consent: {
                  confirmed: true,
                  basis: consentBasis,
                  permittedUses: [
                    'transcription',
                    'memory_grounding',
                    'recording_playback',
                  ],
                },
              },
            ),
        )

      metadataWasCreated = true

      const storedRecording =
        await runAuthenticatedRequest(
          (accessToken) =>
            uploadMemoryRecordingFile(
              accessToken,
              memoryId,
              recording.id,
              recordedFile,
            ),
        )

      recordingWasStored = true

      await runAuthenticatedRequest(
        (accessToken) =>
          requestMemoryRecordingTranscription(
            accessToken,
            memoryId,
            storedRecording.id,
            {
              languageCode: 'he',
            },
          ),
      )

      setPhase('saved')
      setSuccessMessage(
        'התשובה נשמרה ותומללה כטיוטה. עכשיו אפשר לבדוק ולאשר אותה כמקור.',
      )
    } catch (error) {
      setErrorMessage(
        getSaveErrorMessage(error),
      )

      if (metadataWasCreated) {
        setPhase('saved')
        setSuccessMessage(
          'רשומת ההקלטה נשמרה. אפשר להמשיך או לנסות שוב מאזור ההקלטות.',
        )
      } else {
        setPhase('review')
      }
    } finally {
      onBusyChange(false)

      if (metadataWasCreated) {
        notifyRecordingsUpdated(
          memoryId,
        )
      }

      if (recordingWasStored) {
        onAnswerStored(question.key)
      }
    }
  }

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

      if (previewUrlRef.current) {
        URL.revokeObjectURL(
          previewUrlRef.current,
        )
        previewUrlRef.current = ''
      }

      onBusyChange(false)
    }
  }, [
    clearTimers,
    onBusyChange,
    stopStream,
  ])

  if (!browserSupported) {
    return (
      <aside className="guided-recorder-unavailable">
        <strong>
          הקלטה ישירה אינה זמינה בדפדפן הזה
        </strong>

        <p>
          אפשר לענות בכתב כאן, או להעלות קובץ שמע באזור ההקלטות שבהמשך העמוד.
        </p>
      </aside>
    )
  }

  const isRecording =
    phase === 'recording'

  const hasRecording = Boolean(
    recordedFile && previewUrl,
  )

  return (
    <section
      className="guided-recorder"
      aria-labelledby={`guided-recorder-title-${question.key}`}
    >
      <div className="guided-recorder-heading">
        <div>
          <p className="guided-recorder-kicker">
            תשובה קולית
          </p>

          <h3
            id={`guided-recorder-title-${question.key}`}
          >
            ספרו את הסיפור בקול שלכם
          </h3>
        </div>

        <span
          className={`guided-recorder-timer ${
            isRecording
              ? 'guided-recorder-timer-active'
              : ''
          }`}
          aria-label={`זמן הקלטה ${formatDuration(elapsedSeconds)}`}
        >
          {formatDuration(
            elapsedSeconds,
          )}
        </span>
      </div>

      <p className="guided-recorder-guidance">
        אפשר לדבר בחופשיות עד חמש דקות. ההקלטה תישמר יחד עם השאלה הזאת ועם הפרק שלה בארכיון.
      </p>

      {phase === 'idle' && (
        <button
          className="guided-recorder-start"
          type="button"
          onClick={startRecording}
        >
          <span aria-hidden="true" />
          התחלת הקלטה
        </button>
      )}

      {phase === 'requesting' && (
        <p
          className="guided-recorder-status"
          role="status"
        >
          ממתינים לאישור המיקרופון...
        </p>
      )}

      {isRecording && (
        <div className="guided-recorder-live">
          <p role="status">
            מקליטים עכשיו. דברו בנחת ולחצו על עצירה בסיום.
          </p>

          <div className="guided-recorder-live-actions">
            <button
              className="guided-recorder-stop"
              type="button"
              onClick={stopRecording}
            >
              עצירת ההקלטה
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={cancelActiveRecording}
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {phase === 'preparing' && (
        <p
          className="guided-recorder-status"
          role="status"
        >
          מכינים את ההקלטה לבדיקה...
        </p>
      )}

      {hasRecording && (
        <div className="guided-recorder-review">
          <div>
            <strong>
              בדקו את התשובה לפני השמירה
            </strong>

            <audio
              controls
              preload="metadata"
              src={previewUrl}
              aria-label={`תצוגה מקדימה של התשובה לשאלה: ${question.question}`}
            />
          </div>

          {phase === 'review' && (
            <button
              className="secondary-button guided-recorder-again"
              type="button"
              onClick={discardRecording}
            >
              הקלטה מחדש
            </button>
          )}
        </div>
      )}

      {phase === 'review' && (
        <div className="guided-recorder-consent">
          <label>
            <span>
              מי אישר את ההקלטה?
            </span>

            <select
              value={consentBasis}
              onChange={(event) =>
                setConsentBasis(
                  event.target.value,
                )
              }
            >
              <option value="self">
                האדם שבהקלטה הוא אני
              </option>
              <option value="subject_consent">
                האדם נתן הסכמה מפורשת
              </option>
              <option value="authorized_representative">
                אני נציג מורשה
              </option>
              <option value="rights_holder">
                אני בעל הזכויות
              </option>
            </select>
          </label>

          <label className="guided-recorder-checkbox">
            <input
              type="checkbox"
              checked={storageConsent}
              onChange={(event) =>
                setStorageConsent(
                  event.target.checked,
                )
              }
            />

            <span>
              אני מאשר/ת לשמור באופן פרטי את ההקלטה של {subjectName}, להעביר אותה לתמלול ולהשמיע את המקור לבני משפחה בעלי הרשאת צפייה בארכיון.
            </span>
          </label>

          <label className="guided-recorder-checkbox">
            <input
              type="checkbox"
              checked={sourceConsent}
              onChange={(event) =>
                setSourceConsent(
                  event.target.checked,
                )
              }
            />

            <span>
              אני מאשר/ת להשתמש בתמלול כמקור בארכיון רק לאחר בדיקה ואישור נפרדים שלי.
            </span>
          </label>

          <button
            className="primary-button guided-recorder-save"
            type="button"
            onClick={saveRecording}
          >
            שמירה והתחלת תמלול
          </button>
        </div>
      )}

      {phase === 'saving' && (
        <p
          className="guided-recorder-status"
          role="status"
        >
          שומרים את ההקלטה ומתמללים אותה...
        </p>
      )}

      {errorMessage && (
        <p
          className="form-error guided-recorder-message"
          role="alert"
        >
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p
          className="story-success guided-recorder-message"
          role="status"
        >
          {successMessage}
        </p>
      )}

      {phase === 'saved' && (
        <a
          className="secondary-button guided-recorder-review-link"
          href="#recordings-title"
        >
          מעבר לבדיקת התמלול ואישורו
        </a>
      )}
    </section>
  )
}

export default GuidedInterviewRecorder
