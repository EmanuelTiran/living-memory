import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/authApi.js'
import {
  getMemoryTimeline,
} from '../../api/memoryApi.js'
import {
  getMemoryRecordingAudio,
} from '../../api/recordingApi.js'
import './MemoryTimeline.css'

const sourceTypeLabels =
  Object.freeze({
    memory_story:
      'סיפור כתוב מאושר',
    recording_transcript:
      'הקלטה ותמלול מאושרים',
  })

function getTimelineErrorMessage(error) {
  if (!(error instanceof ApiError)) {
    return 'אירעה שגיאה בלתי צפויה.'
  }

  const messages = {
    MEMORY_NOT_FOUND:
      'הזיכרון לא נמצא או שאין לכם הרשאה לצפות בו.',
    RECORDING_NOT_FOUND:
      'ההקלטה המקורית אינה זמינה יותר.',
    RECORDING_PLAYBACK_NOT_CONSENTED:
      'לא ניתנה הרשאה להשמעת ההקלטה המקורית.',
    RECORDING_FILE_UNAVAILABLE:
      'קובץ ההקלטה המקורית אינו זמין כרגע.',
    RECORDING_FILE_NOT_FOUND:
      'קובץ ההקלטה המקורית לא נמצא.',
    RECORDING_INTEGRITY_FAILED:
      'בדיקת תקינות ההקלטה נכשלה ולכן היא לא הושמעה.',
    AUTHENTICATION_REQUIRED:
      'החיבור לחשבון הסתיים. יש להתחבר מחדש.',
    NETWORK_ERROR:
      'לא הצלחנו להתחבר לשרת.',
  }

  return messages[error.code] ??
    'לא הצלחנו לטעון את ציר הזמן.'
}

function formatDateOnly(value) {
  const [year, month, day] =
    value.split('-').map(Number)

  const date = new Date(
    Date.UTC(year, month - 1, day),
  )

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      dateStyle: 'long',
      timeZone: 'UTC',
    },
  ).format(date)
}

function formatDocumentedDate(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      dateStyle: 'medium',
    },
  ).format(date)
}

function TimelineEntry({
  entry,
  subjectName,
  audioUrl,
  audioError,
  isLoadingAudio,
  onLoadAudio,
}) {
  const documentedDate =
    entry.documentedAt
      ? formatDocumentedDate(
          entry.documentedAt,
        )
      : ''

  return (
    <article className="memory-timeline-entry">
      <div className="memory-timeline-marker" aria-hidden="true" />

      <div className="memory-timeline-card">
        <header>
          <span className="memory-timeline-source-type">
            {sourceTypeLabels[
              entry.sourceType
            ] ?? 'מקור מאושר'}
          </span>

          {entry.occurredOn ? (
            <time dateTime={entry.occurredOn}>
              {formatDateOnly(
                entry.occurredOn,
              )}
            </time>
          ) : (
            documentedDate && (
              <time dateTime={entry.documentedAt}>
                {entry.sourceType ===
                'recording_transcript'
                  ? 'תועד'
                  : 'נשמר'}{' '}
                בארכיון ב־{documentedDate}
              </time>
            )
          )}
        </header>

        <h4>{entry.title}</h4>
        <p>{entry.summary}</p>

        <div className="memory-timeline-actions">
          <Link
            to={entry.sourceRoute}
            state={{ subjectName }}
          >
            פתיחת המקור
          </Link>

          {entry.canPlayOriginalAudio &&
            entry.recordingId &&
            !audioUrl && (
              <button
                type="button"
                disabled={isLoadingAudio}
                onClick={() =>
                  onLoadAudio(entry)
                }
              >
                {isLoadingAudio
                  ? 'טוענים הקלטה...'
                  : 'השמעת המקור'}
              </button>
            )}
        </div>

        {audioUrl && (
          <audio
            controls
            preload="metadata"
            src={audioUrl}
            aria-label={`הקלטת המקור: ${entry.title}`}
          />
        )}

        {audioError && (
          <p
            className="memory-timeline-audio-error"
            role="alert"
          >
            {audioError}
          </p>
        )}
      </div>
    </article>
  )
}

function MemoryTimeline({
  memoryId,
  subjectName,
  runAuthenticatedRequest,
  refreshKey,
}) {
  const [timeline, setTimeline] =
    useState({
      datedEntries: [],
      undatedEntries: [],
      totalCount: 0,
    })
  const [isLoading, setIsLoading] =
    useState(true)
  const [errorMessage, setErrorMessage] =
    useState('')
  const [audioUrls, setAudioUrls] =
    useState({})
  const [audioErrors, setAudioErrors] =
    useState({})
  const [loadingRecordingId, setLoadingRecordingId] =
    useState('')
  const audioUrlRegistryRef = useRef(
    new Map(),
  )

  const fetchTimeline = useCallback(
    () =>
      runAuthenticatedRequest(
        (accessToken) =>
          getMemoryTimeline(
            accessToken,
            memoryId,
          ),
      ),
    [
      memoryId,
      runAuthenticatedRequest,
    ],
  )

  useEffect(() => {
    let isActive = true

    setErrorMessage('')

    void fetchTimeline()
      .then((nextTimeline) => {
        if (isActive) {
          setTimeline(nextTimeline)
        }
      })
      .catch((error) => {
        if (isActive) {
          setErrorMessage(
            getTimelineErrorMessage(
              error,
            ),
          )
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [fetchTimeline, refreshKey])

  useEffect(() => {
    let isActive = true

    function handleRecordingsUpdated(event) {
      if (
        event.detail?.memoryId !==
        memoryId
      ) {
        return
      }

      void fetchTimeline()
        .then((nextTimeline) => {
          if (isActive) {
            setTimeline(nextTimeline)
          }
        })
        .catch((error) => {
          if (isActive) {
            setErrorMessage(
              getTimelineErrorMessage(
                error,
              ),
            )
          }
        })
    }

    window.addEventListener(
      'living-memory:recordings-updated',
      handleRecordingsUpdated,
    )

    return () => {
      isActive = false
      window.removeEventListener(
        'living-memory:recordings-updated',
        handleRecordingsUpdated,
      )
    }
  }, [fetchTimeline, memoryId])

  useEffect(() => {
    const registry =
      audioUrlRegistryRef.current

    return () => {
      for (const url of registry.values()) {
        URL.revokeObjectURL(url)
      }

      registry.clear()
    }
  }, [])

  async function loadOriginalAudio(entry) {
    const recordingId =
      entry.recordingId

    setLoadingRecordingId(recordingId)
    setAudioErrors((current) => ({
      ...current,
      [recordingId]: '',
    }))

    try {
      const audioBlob =
        await runAuthenticatedRequest(
          (accessToken) =>
            getMemoryRecordingAudio(
              accessToken,
              memoryId,
              recordingId,
            ),
        )

      const previousUrl =
        audioUrlRegistryRef.current.get(
          recordingId,
        )

      if (previousUrl) {
        URL.revokeObjectURL(previousUrl)
      }

      const audioUrl =
        URL.createObjectURL(audioBlob)

      audioUrlRegistryRef.current.set(
        recordingId,
        audioUrl,
      )

      setAudioUrls((current) => ({
        ...current,
        [recordingId]: audioUrl,
      }))
    } catch (error) {
      setAudioErrors((current) => ({
        ...current,
        [recordingId]:
          getTimelineErrorMessage(error),
      }))
    } finally {
      setLoadingRecordingId('')
    }
  }

  function renderEntry(entry) {
    return (
      <TimelineEntry
        key={entry.id}
        entry={entry}
        subjectName={subjectName}
        audioUrl={
          audioUrls[
            entry.recordingId
          ] ?? ''
        }
        audioError={
          audioErrors[
            entry.recordingId
          ] ?? ''
        }
        isLoadingAudio={
          loadingRecordingId ===
          entry.recordingId
        }
        onLoadAudio={loadOriginalAudio}
      />
    )
  }

  return (
    <section
      className="memory-timeline"
      aria-labelledby="memory-timeline-title"
    >
      <header className="memory-timeline-heading">
        <div>
          <p className="panel-kicker">
            סיפור החיים לאורך השנים
          </p>

          <h2 id="memory-timeline-title">
            ציר הזמן של {subjectName}
          </h2>

          <p>
            ציר הזמן מציג רק מקורות מאושרים.
            כשאין תאריך מפורש, הזיכרון נשאר
            ללא תאריך במקום שהמערכת תנחש.
          </p>
        </div>

        <span className="memory-timeline-count">
          {timeline.totalCount}{' '}
          {timeline.totalCount === 1
            ? 'זיכרון'
            : 'זיכרונות'}
        </span>
      </header>

      {errorMessage && (
        <p
          className="form-error memory-timeline-message"
          role="alert"
        >
          {errorMessage}
        </p>
      )}

      {isLoading ? (
        <div className="memory-timeline-empty">
          <span className="loading-spinner" />
          <p>טוענים את ציר הזמן...</p>
        </div>
      ) : timeline.totalCount === 0 ? (
        <div className="memory-timeline-empty">
          <strong>
            ציר הזמן עדיין ממתין לסיפור הראשון
          </strong>
          <p>
            לאחר אישור סיפור כתוב או תמלול,
            הוא יופיע כאן עם המקור שלו.
          </p>
        </div>
      ) : (
        <div className="memory-timeline-content">
          {timeline.datedEntries.length > 0 && (
            <section
              aria-labelledby="dated-memories-title"
            >
              <h3 id="dated-memories-title">
                אירועים מתוארכים
              </h3>

              <div className="memory-timeline-list">
                {timeline.datedEntries.map(
                  renderEntry,
                )}
              </div>
            </section>
          )}

          {timeline.undatedEntries.length > 0 && (
            <section
              className="memory-timeline-undated"
              aria-labelledby="undated-memories-title"
            >
              <div>
                <h3 id="undated-memories-title">
                  זיכרונות שמחכים לתאריך
                </h3>
                <p>
                  תאריך התיעוד מוצג כשקיים,
                  אבל אינו מוצג כתאריך האירוע.
                </p>
              </div>

              <div className="memory-timeline-list">
                {timeline.undatedEntries.map(
                  renderEntry,
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  )
}

export default MemoryTimeline
