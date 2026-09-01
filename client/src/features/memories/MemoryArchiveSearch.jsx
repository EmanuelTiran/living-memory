import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/authApi.js'
import {
  searchMemoryArchive,
} from '../../api/memoryApi.js'
import {
  getMemoryRecordingAudio,
} from '../../api/recordingApi.js'
import './MemoryArchiveSearch.css'

const initialSearchForm = Object.freeze({
  query: '',
  sourceType: 'all',
  audioFilter: 'all',
})

const sourceTypeLabels =
  Object.freeze({
    memory_profile:
      'פרטי הארכיון',
    biography_answer:
      'תשובה ביוגרפית',
    memory_story:
      'סיפור כתוב מאושר',
    recording_transcript:
      'הקלטה ותמלול מאושרים',
  })

function getSearchErrorMessage(error) {
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
    VALIDATION_ERROR:
      'מילות החיפוש או אפשרויות הסינון אינן תקינות.',
    AUTHENTICATION_REQUIRED:
      'החיבור לחשבון הסתיים. יש להתחבר מחדש.',
    NETWORK_ERROR:
      'לא הצלחנו להתחבר לשרת.',
  }

  return messages[error.code] ??
    'לא הצלחנו לחפש בארכיון.'
}

function formatSourceDate(value) {
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

function MemoryArchiveSearch({
  memoryId,
  subjectName,
  runAuthenticatedRequest,
}) {
  const [form, setForm] = useState({
    ...initialSearchForm,
  })
  const [search, setSearch] = useState({
    results: [],
    total: 0,
    limit: 30,
  })
  const [isLoading, setIsLoading] =
    useState(true)
  const [errorMessage, setErrorMessage] =
    useState('')
  const [hasSearched, setHasSearched] =
    useState(false)
  const [audioUrls, setAudioUrls] =
    useState({})
  const [audioErrors, setAudioErrors] =
    useState({})
  const [loadingRecordingId, setLoadingRecordingId] =
    useState('')
  const audioUrlRegistryRef = useRef(
    new Map(),
  )

  const executeSearch = useCallback(
    async (nextForm) => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const nextSearch =
          await runAuthenticatedRequest(
            (accessToken) =>
              searchMemoryArchive(
                accessToken,
                memoryId,
                nextForm,
              ),
          )

        setSearch(nextSearch)
        setHasSearched(true)
      } catch (error) {
        setErrorMessage(
          getSearchErrorMessage(error),
        )
      } finally {
        setIsLoading(false)
      }
    },
    [memoryId, runAuthenticatedRequest],
  )

  useEffect(() => {
    let isActive = true

    void runAuthenticatedRequest(
      (accessToken) =>
        searchMemoryArchive(
          accessToken,
          memoryId,
          initialSearchForm,
        ),
    )
      .then((nextSearch) => {
        if (isActive) {
          setSearch(nextSearch)
          setHasSearched(true)
        }
      })
      .catch((error) => {
        if (isActive) {
          setErrorMessage(
            getSearchErrorMessage(error),
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
  }, [memoryId, runAuthenticatedRequest])

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

  function handleFormChange(event) {
    const { name, value } =
      event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    void executeSearch(form)
  }

  function handleClear() {
    const clearedForm = {
      ...initialSearchForm,
    }

    setForm(clearedForm)
    void executeSearch(clearedForm)
  }

  async function loadOriginalAudio(result) {
    const recordingId =
      result.recordingId

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
          getSearchErrorMessage(error),
      }))
    } finally {
      setLoadingRecordingId('')
    }
  }

  const hasActiveFilters =
    form.query.trim().length > 0 ||
    form.sourceType !== 'all' ||
    form.audioFilter !== 'all'

  return (
    <section
      className="memory-archive-search"
      aria-labelledby="memory-archive-search-title"
    >
      <header className="memory-archive-search-heading">
        <div>
          <p className="panel-kicker">
            מוצאים זיכרון בתוך שניות
          </p>

          <h2 id="memory-archive-search-title">
            חיפוש בארכיון של {subjectName}
          </h2>

          <p>
            החיפוש עובר רק על פרטי ארכיון
            ומקורות שאושרו. טיוטות וחומרים
            ללא הרשאת שימוש אינם מופיעים.
          </p>
        </div>

        <span className="memory-archive-search-count">
          {search.total}{' '}
          {search.total === 1
            ? 'תוצאה'
            : 'תוצאות'}
        </span>
      </header>

      <form
        className="memory-archive-search-form"
        onSubmit={handleSubmit}
        aria-busy={isLoading}
      >
        <label className="memory-archive-search-query">
          <span>מה מחפשים?</span>
          <input
            type="search"
            name="query"
            value={form.query}
            maxLength={120}
            placeholder="לדוגמה: ירושלים, עבודה או ארוחות שבת"
            onChange={handleFormChange}
          />
        </label>

        <div className="memory-archive-search-filters">
          <label>
            <span>סוג מקור</span>
            <select
              name="sourceType"
              value={form.sourceType}
              onChange={handleFormChange}
            >
              <option value="all">
                כל המקורות
              </option>
              <option value="memory_profile">
                פרטי הארכיון
              </option>
              <option value="biography_answer">
                תשובות ביוגרפיות
              </option>
              <option value="memory_story">
                סיפורים כתובים
              </option>
              <option value="recording_transcript">
                הקלטות ותמלולים
              </option>
            </select>
          </label>

          <label>
            <span>הקלטה מקורית</span>
            <select
              name="audioFilter"
              value={form.audioFilter}
              onChange={handleFormChange}
            >
              <option value="all">
                כל המקורות
              </option>
              <option value="playable">
                רק מקורות שניתן להשמיע
              </option>
            </select>
          </label>
        </div>

        <div className="memory-archive-search-buttons">
          <button
            className="primary-button"
            type="submit"
            data-aura-tooltip="לחפש בתוך המקורות המאושרים"
            disabled={isLoading}
          >
            {isLoading
              ? 'מחפשים...'
              : 'חיפוש וסינון'}
          </button>

          {hasActiveFilters && (
            <button
              className="secondary-button"
              type="button"
              data-aura-tooltip="לנקות את החיפוש והסינונים"
              disabled={isLoading}
              onClick={handleClear}
            >
              ניקוי החיפוש
            </button>
          )}
        </div>
      </form>

      {errorMessage && (
        <p
          className="form-error memory-archive-search-message"
          role="alert"
        >
          {errorMessage}
        </p>
      )}

      {!isLoading &&
        hasSearched &&
        search.results.length === 0 &&
        !errorMessage && (
          <div className="memory-archive-search-empty">
            <strong>
              לא נמצא מקור מאושר שמתאים לחיפוש
            </strong>
            <p>
              אפשר לנסות מילה אחרת או לנקות
              אחד מהסינונים.
            </p>
          </div>
        )}

      {search.results.length > 0 && (
        <>
          {search.total >
            search.results.length && (
              <p className="memory-archive-search-limit-note">
                מוצגות{' '}
                {search.results.length}{' '}
                התוצאות הראשונות מתוך{' '}
                {search.total}.
              </p>
            )}

          <div className="memory-archive-search-results">
            {search.results.map(
              (result, index) => {
                const audioUrl =
                  audioUrls[
                    result.recordingId
                  ] ?? ''
                const audioError =
                  audioErrors[
                    result.recordingId
                  ] ?? ''
                const sourceDate =
                  result.sourceDate
                    ? formatSourceDate(
                        result.sourceDate,
                      )
                    : ''

                return (
                  <article
                    className="memory-archive-search-result"
                    key={`${result.sourceType}:${result.sourceId}:${index}`}
                  >
                    <header>
                      <span>
                        {sourceTypeLabels[
                          result.sourceType
                        ] ?? 'מקור מאושר'}
                      </span>

                      {sourceDate && (
                        <time
                          dateTime={
                            result.sourceDate
                          }
                        >
                          תאריך המקור:{' '}
                          {sourceDate}
                        </time>
                      )}
                    </header>

                    <h3>{result.title}</h3>
                    <p>“{result.excerpt}”</p>

                    <div className="memory-archive-search-actions">
                      {result.sourceRoute && (
                        <Link
                          to={result.sourceRoute}
                          data-aura-tooltip="לפתוח את המקור בתוך הארכיון"
                          state={{ subjectName }}
                        >
                          פתיחת המקור בארכיון
                        </Link>
                      )}

                      {result.canPlayOriginalAudio &&
                        result.recordingId &&
                        !audioUrl && (
                          <button
                            type="button"
                            data-aura-tooltip="לשמוע את הקלטת המקור"
                            disabled={
                              loadingRecordingId ===
                              result.recordingId
                            }
                            onClick={() =>
                              loadOriginalAudio(
                                result,
                              )
                            }
                          >
                            {loadingRecordingId ===
                            result.recordingId
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
                        aria-label={`הקלטת המקור: ${result.title}`}
                      />
                    )}

                    {audioError && (
                      <p
                        className="memory-archive-search-audio-error"
                        role="alert"
                      >
                        {audioError}
                      </p>
                    )}
                  </article>
                )
              },
            )}
          </div>
        </>
      )}
    </section>
  )
}

export default MemoryArchiveSearch
