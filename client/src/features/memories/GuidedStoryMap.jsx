import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ApiError } from '../../api/authApi.js'
import {
  getMemoryRecordingAudio,
  getMemoryRecordingTranscript,
  listGuidedMemoryStories,
} from '../../api/recordingApi.js'
import './GuidedStoryMap.css'

const STORY_CHAPTERS = Object.freeze([
  ['background', 'רקע ומשפחה'],
  ['childhood', 'ילדות'],
  ['education_work', 'לימודים ועבודה'],
  ['relationships', 'משפחה וקשרים'],
  ['personality', 'אופי ואישיות'],
  ['preferences', 'העדפות ותחביבים'],
  ['values', 'ערכים ואמונה'],
  ['life_events', 'תחנות בחיים'],
  ['family_questions', 'שאלות מהמשפחה'],
])

function getStoryErrorMessage(error) {
  if (!(error instanceof ApiError)) {
    return 'אירעה שגיאה בלתי צפויה.'
  }

  const messages = {
    MEMORY_NOT_FOUND:
      'הזיכרון לא נמצא או שאין לכם הרשאה לצפות בו.',
    RECORDING_NOT_FOUND:
      'ההקלטה אינה זמינה יותר.',
    RECORDING_TRANSCRIPT_NOT_FOUND:
      'התמלול המאושר אינו זמין יותר.',
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

  return (
    messages[error.code] ??
    'לא הצלחנו לטעון את הסיפור.'
  )
}

function formatDate(value) {
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

function formatDuration(durationMs) {
  if (
    !Number.isFinite(durationMs) ||
    durationMs < 1
  ) {
    return ''
  }

  const totalSeconds = Math.max(
    1,
    Math.round(durationMs / 1000),
  )

  const minutes = Math.floor(
    totalSeconds / 60,
  )

  const seconds = String(
    totalSeconds % 60,
  ).padStart(2, '0')

  return `${minutes}:${seconds}`
}

function GuidedStoryMap({
  memoryId,
  subjectName,
  runAuthenticatedRequest,
}) {
  const [stories, setStories] =
    useState([])
  const [selectedChapter, setSelectedChapter] =
    useState('all')
  const [isLoading, setIsLoading] =
    useState(true)
  const [errorMessage, setErrorMessage] =
    useState('')
  const [audioUrls, setAudioUrls] =
    useState({})
  const [audioErrors, setAudioErrors] =
    useState({})
  const [loadingAudioId, setLoadingAudioId] =
    useState('')
  const [transcripts, setTranscripts] =
    useState({})
  const [openTranscriptId, setOpenTranscriptId] =
    useState('')
  const [loadingTranscriptId, setLoadingTranscriptId] =
    useState('')
  const audioUrlRegistryRef = useRef(
    new Map(),
  )

  const fetchStories = useCallback(
    () =>
      runAuthenticatedRequest(
        (accessToken) =>
          listGuidedMemoryStories(
            accessToken,
            memoryId,
          ),
      ),
    [memoryId, runAuthenticatedRequest],
  )

  useEffect(() => {
    let isActive = true

    void fetchStories()
      .then((nextStories) => {
        if (isActive) {
          setStories(nextStories)
        }
      })
      .catch((error) => {
        if (isActive) {
          setErrorMessage(
            getStoryErrorMessage(error),
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
  }, [fetchStories])

  useEffect(() => {
    let isActive = true

    function handleRecordingsUpdated(event) {
      if (
        event.detail?.memoryId !==
        memoryId
      ) {
        return
      }

      void fetchStories()
        .then((nextStories) => {
          if (isActive) {
            setStories(nextStories)
          }
        })
        .catch((error) => {
          if (isActive) {
            setErrorMessage(
              getStoryErrorMessage(error),
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
  }, [fetchStories, memoryId])

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

  const chapterCounts = useMemo(() => {
    const counts = {}

    for (const story of stories) {
      counts[story.chapter.key] =
        (counts[story.chapter.key] ?? 0) + 1
    }

    return counts
  }, [stories])

  const visibleStories = useMemo(
    () =>
      selectedChapter === 'all'
        ? stories
        : stories.filter(
            (story) =>
              story.chapter.key ===
              selectedChapter,
          ),
    [selectedChapter, stories],
  )

  async function loadOriginalAudio(story) {
    setLoadingAudioId(story.recordingId)
    setAudioErrors((current) => ({
      ...current,
      [story.recordingId]: '',
    }))

    try {
      const audioBlob =
        await runAuthenticatedRequest(
          (accessToken) =>
            getMemoryRecordingAudio(
              accessToken,
              memoryId,
              story.recordingId,
            ),
        )

      const previousUrl =
        audioUrlRegistryRef.current.get(
          story.recordingId,
        )

      if (previousUrl) {
        URL.revokeObjectURL(previousUrl)
      }

      const audioUrl =
        URL.createObjectURL(audioBlob)

      audioUrlRegistryRef.current.set(
        story.recordingId,
        audioUrl,
      )

      setAudioUrls((current) => ({
        ...current,
        [story.recordingId]: audioUrl,
      }))
    } catch (error) {
      setAudioErrors((current) => ({
        ...current,
        [story.recordingId]:
          getStoryErrorMessage(error),
      }))
    } finally {
      setLoadingAudioId('')
    }
  }

  async function toggleTranscript(story) {
    if (
      openTranscriptId ===
      story.recordingId
    ) {
      setOpenTranscriptId('')
      return
    }

    if (transcripts[story.recordingId]) {
      setOpenTranscriptId(
        story.recordingId,
      )
      return
    }

    setLoadingTranscriptId(
      story.recordingId,
    )
    setErrorMessage('')

    try {
      const transcript =
        await runAuthenticatedRequest(
          (accessToken) =>
            getMemoryRecordingTranscript(
              accessToken,
              memoryId,
              story.recordingId,
            ),
        )

      setTranscripts((current) => ({
        ...current,
        [story.recordingId]: transcript,
      }))
      setOpenTranscriptId(
        story.recordingId,
      )
    } catch (error) {
      setErrorMessage(
        getStoryErrorMessage(error),
      )
    } finally {
      setLoadingTranscriptId('')
    }
  }

  return (
    <section
      id="guided-story-map"
      className="guided-story-map"
      aria-labelledby="guided-story-map-title"
    >
      <header className="guided-story-map-heading">
        <div>
          <p className="panel-kicker">
            הארכיון החי
          </p>

          <h2 id="guided-story-map-title">
            מפת הסיפורים של {subjectName}
          </h2>

          <p>
            כאן מופיעים רק סיפורים שהתמלול שלהם נבדק ואושר כמקור אמין.
          </p>
        </div>

        <span className="guided-story-total">
          {stories.length}
          {' '}
          סיפורים מאושרים
        </span>
      </header>

      <nav
        className="guided-story-chapters"
        aria-label="סינון סיפורים לפי פרק חיים"
      >
        <button
          type="button"
          className={
            selectedChapter === 'all'
              ? 'guided-story-chapter-active'
              : ''
          }
          onClick={() =>
            setSelectedChapter('all')
          }
        >
          הכול
          <span>{stories.length}</span>
        </button>

        {STORY_CHAPTERS.map(
          ([chapterKey, label]) => (
            <button
              type="button"
              className={
                selectedChapter ===
                chapterKey
                  ? 'guided-story-chapter-active'
                  : ''
              }
              key={chapterKey}
              onClick={() =>
                setSelectedChapter(
                  chapterKey,
                )
              }
            >
              {label}
              <span>
                {chapterCounts[
                  chapterKey
                ] ?? 0}
              </span>
            </button>
          ),
        )}
      </nav>

      {errorMessage && (
        <p
          className="form-error guided-story-map-message"
          role="alert"
        >
          {errorMessage}
        </p>
      )}

      {isLoading ? (
        <div
          className="guided-story-map-loading"
          aria-live="polite"
        >
          <span
            className="loading-indicator"
            aria-hidden="true"
          />
          <p>טוענים את מפת הסיפורים...</p>
        </div>
      ) : stories.length === 0 ? (
        <div className="guided-story-map-empty">
          <strong>
            הסיפור המאושר הראשון עוד בדרך
          </strong>

          <p>
            הקליטו תשובה בראיון, בדקו את התמלול ואשרו אותו. לאחר האישור הוא יופיע כאן אוטומטית.
          </p>
        </div>
      ) : visibleStories.length === 0 ? (
        <div className="guided-story-map-empty">
          <strong>
            בפרק הזה עדיין אין סיפור מאושר
          </strong>

          <p>
            אפשר לבחור פרק אחר או להמשיך לראיון הבא.
          </p>
        </div>
      ) : (
        <div className="guided-story-grid">
          {visibleStories.map((story, storyIndex) => {
            const audioUrl =
              audioUrls[story.recordingId]

            const audioError =
              audioErrors[story.recordingId]

            const transcript =
              transcripts[story.recordingId]

            const isTranscriptOpen =
              openTranscriptId ===
              story.recordingId

            return (
              <article
                className={`guided-story-card ${
                  storyIndex === 0 ? 'guided-story-card-featured' : ''
                }`}
                key={story.id}
              >
                {storyIndex === 0 && (
                  <div className="guided-story-visual" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                )}

                <header>
                  <div className="guided-story-labels">
                    <p>
                      {story.chapter.label}
                    </p>

                    <span className="guided-story-status">
                      מאומת
                    </span>
                  </div>

                  <h3>{story.title}</h3>
                </header>

                <p className="guided-story-summary">
                  {story.summary}
                </p>

                <dl className="guided-story-metadata">
                  {story.recordedAt && (
                    <div>
                      <dt>הוקלט</dt>
                      <dd>
                        {formatDate(
                          story.recordedAt,
                        )}
                      </dd>
                    </div>
                  )}

                  {story.durationMs && (
                    <div>
                      <dt>משך</dt>
                      <dd>
                        {formatDuration(
                          story.durationMs,
                        )}
                      </dd>
                    </div>
                  )}
                </dl>

                <blockquote className="guided-story-question">
                  <span>השאלה שנשאלה</span>
                  {story.question}
                </blockquote>

                <div className="guided-story-actions">
                  {story.canPlayOriginalAudio &&
                    !audioUrl && (
                      <button
                        className="primary-button"
                        type="button"
                        disabled={
                          loadingAudioId ===
                          story.recordingId
                        }
                        onClick={() =>
                          loadOriginalAudio(
                            story,
                          )
                        }
                      >
                        {loadingAudioId ===
                        story.recordingId
                          ? 'טוענים את המקור...'
                          : 'השמעת ההקלטה המקורית'}
                      </button>
                    )}

                  <button
                    className="secondary-button"
                    type="button"
                    disabled={
                      loadingTranscriptId ===
                      story.recordingId
                    }
                    onClick={() =>
                      toggleTranscript(story)
                    }
                  >
                    {loadingTranscriptId ===
                    story.recordingId
                      ? 'טוענים תמלול...'
                      : isTranscriptOpen
                        ? 'סגירת התמלול'
                        : 'פתיחת התמלול המלא'}
                  </button>
                </div>

                {audioUrl && (
                  <audio
                    controls
                    preload="metadata"
                    src={audioUrl}
                    aria-label={`ההקלטה המקורית של הסיפור: ${story.title}`}
                  />
                )}

                {!story.canPlayOriginalAudio && (
                  <p className="guided-story-audio-unavailable">
                    לא ניתנה להקלטה הזאת הרשאת השמעת מקור.
                  </p>
                )}

                {audioError && (
                  <p
                    className="form-error guided-story-audio-error"
                    role="alert"
                  >
                    {audioError}
                  </p>
                )}

                {isTranscriptOpen &&
                  transcript && (
                    <div className="guided-story-transcript">
                      <strong>
                        תמלול מאושר
                      </strong>

                      <p>
                        {transcript.content}
                      </p>
                    </div>
                  )}

                <aside className="guided-story-follow-up">
                  <span>
                    הצעה לשאלת המשך
                  </span>

                  <p>
                    {story.followUpQuestion}
                  </p>
                </aside>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default GuidedStoryMap
