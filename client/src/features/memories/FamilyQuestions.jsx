import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/authApi.js'
import {
  revealAuraTarget,
} from '../../auraMotion.js'
import {
  createFamilyQuestion,
  listFamilyQuestions,
} from '../../api/familyQuestionApi.js'
import {
  listMemoryRecordings,
} from '../../api/recordingApi.js'
import GuidedInterviewRecorder from './GuidedInterviewRecorder.jsx'
import './FamilyQuestions.css'

function getErrorMessage(error) {
  if (!(error instanceof ApiError)) {
    return 'אירעה שגיאה בלתי צפויה.'
  }

  const messages = {
    MEMORY_NOT_FOUND:
      'הזיכרון לא נמצא או שאין לכם הרשאה לצפות בו.',
    FAMILY_QUESTION_NOT_FOUND:
      'השאלה אינה זמינה יותר.',
    VALIDATION_ERROR:
      'השאלה צריכה להכיל בין 5 ל־500 תווים.',
    AUTHENTICATION_REQUIRED:
      'החיבור לחשבון הסתיים. יש להתחבר מחדש.',
    NETWORK_ERROR:
      'לא הצלחנו להתחבר לשרת.',
  }

  return (
    messages[error.code] ??
    'לא הצלחנו להשלים את הפעולה.'
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

function getFamilyQuestionId(recording) {
  return recording.familyQuestionContext
    ?.questionId ?? ''
}

function FamilyQuestions({
  canContribute = true,
  focusQuestionId = '',
  memoryId,
  subjectName,
  subjectGender = 'unspecified',
  runAuthenticatedRequest,
}) {
  const [questions, setQuestions] =
    useState([])
  const [recordings, setRecordings] =
    useState([])
  const [draft, setDraft] =
    useState('')
  const [answeringQuestionId, setAnsweringQuestionId] =
    useState('')
  const [isLoading, setIsLoading] =
    useState(true)
  const [isSubmitting, setIsSubmitting] =
    useState(false)
  const [recorderBusy, setRecorderBusy] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState('')
  const [successMessage, setSuccessMessage] =
    useState('')

  const loadQuestions = useCallback(
    () =>
      runAuthenticatedRequest(
        (accessToken) =>
          Promise.all([
            listFamilyQuestions(
              accessToken,
              memoryId,
            ),
            listMemoryRecordings(
              accessToken,
              memoryId,
            ),
          ]),
      ),
    [memoryId, runAuthenticatedRequest],
  )

  useEffect(() => {
    let isActive = true

    void loadQuestions()
      .then(([
        nextQuestions,
        nextRecordings,
      ]) => {
        if (isActive) {
          setQuestions(nextQuestions)
          setRecordings(nextRecordings)
        }
      })
      .catch((error) => {
        if (isActive) {
          setErrorMessage(
            getErrorMessage(error),
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
  }, [loadQuestions])

  useEffect(() => {
    let isActive = true

    function handleRecordingsUpdated(event) {
      if (
        event.detail?.memoryId !==
        memoryId
      ) {
        return
      }

      void loadQuestions()
        .then(([
          nextQuestions,
          nextRecordings,
        ]) => {
          if (isActive) {
            setQuestions(nextQuestions)
            setRecordings(nextRecordings)
            setAnsweringQuestionId('')
          }
        })
        .catch((error) => {
          if (isActive) {
            setErrorMessage(
              getErrorMessage(error),
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
  }, [loadQuestions, memoryId])

  useEffect(() => {
    if (
      isLoading ||
      !focusQuestionId
    ) {
      return undefined
    }

    const frameId =
      window.requestAnimationFrame(() => {
        const target =
          document.getElementById(
            `family-question-${focusQuestionId}`,
          )

        target
          ?.closest(
            'details.family-question-list-more',
          )
          ?.setAttribute('open', '')

        revealAuraTarget(target, {
          block: 'center',
        })
        target?.focus({
          preventScroll: true,
        })
      })

    return () => {
      window.cancelAnimationFrame(
        frameId,
      )
    }
  }, [
    focusQuestionId,
    isLoading,
    questions,
  ])

  const answeredQuestionIds = useMemo(
    () =>
      new Set(
        recordings
          .filter(
            (recording) =>
              recording.storageStatus ===
                'stored' &&
              getFamilyQuestionId(
                recording,
              ),
          )
          .map(getFamilyQuestionId),
      ),
    [recordings],
  )

  const pendingQuestions = useMemo(
    () =>
      questions.filter(
        (question) =>
          !answeredQuestionIds.has(
            question.id,
          ),
      ),
    [answeredQuestionIds, questions],
  )

  async function handleSubmit(event) {
    event.preventDefault()

    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const familyQuestion =
        await runAuthenticatedRequest(
          (accessToken) =>
            createFamilyQuestion(
              accessToken,
              memoryId,
              {
                question: draft,
              },
            ),
        )

      setQuestions((current) => [
        familyQuestion,
        ...current,
      ])
      setDraft('')
      setSuccessMessage(
        `השאלה נשמרה ותמתין לתשובה של ${subjectName}.`,
      )
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function startAnswering(questionId) {
    setErrorMessage('')
    setSuccessMessage('')
    setAnsweringQuestionId(
      (current) =>
        current === questionId
          ? ''
          : questionId,
    )
  }

  function handleAnswerStored() {
    setSuccessMessage(
      'התשובה הקולית נשמרה. לאחר בדיקת התמלול ואישורו היא תופיע גם במפת הסיפורים.',
    )
  }

  function renderQuestionCard(question) {
    const isAnswered =
      answeredQuestionIds.has(question.id)
    const isAnswering =
      answeringQuestionId === question.id

    return (
      <article
        id={`family-question-${question.id}`}
        className={`family-question-card ${
          isAnswered
            ? 'family-question-card-answered'
            : ''
        }`}
        key={question.id}
        tabIndex={-1}
      >
        <div className="family-question-card-heading">
          <div>
            <span>
              {question.askedByCurrentUser
                ? 'השאלה שלך'
                : 'שאלה מהמשפחה'}
            </span>

            <time dateTime={question.createdAt}>
              {formatDate(question.createdAt)}
            </time>
          </div>

          <span className="family-question-status">
            {isAnswered
              ? 'נענתה בקול'
              : 'ממתינה לתשובה'}
          </span>
        </div>

        <p className="family-question-text">
          {question.question}
        </p>

        {isAnswered ? (
          <Link
            className="secondary-button"
            data-aura-tooltip="לפתוח את ההקלטה והתמלול בארכיון"
            to={`/app/memories/${encodeURIComponent(memoryId)}?tab=archive#recordings-title`}
          >
            מעבר להקלטה ולתמלול
          </Link>
        ) : !canContribute ? (
          <p className="family-question-viewer-note">
            מענה קולי זמין לבני משפחה בעלי הרשאת תיעוד.
          </p>
        ) : (
          <button
            className="primary-button"
            type="button"
            data-aura-tooltip={
              isAnswering
                ? 'לסגור את אזור ההקלטה'
                : 'להקליט תשובה לשאלה המשפחתית'
            }
            disabled={
              recorderBusy && !isAnswering
            }
            onClick={() =>
              startAnswering(question.id)
            }
          >
            {isAnswering
              ? 'סגירת ההקלטה'
              : 'לענות בקול'}
          </button>
        )}

        {canContribute && isAnswering && (
          <GuidedInterviewRecorder
            key={question.id}
            memoryId={memoryId}
            familyQuestionId={question.id}
            question={{
              key: `family_${question.id}`,
              question: question.question,
              category: 'family_questions',
            }}
            subjectName={subjectName}
            runAuthenticatedRequest={
              runAuthenticatedRequest
            }
            onBusyChange={setRecorderBusy}
            onAnswerStored={handleAnswerStored}
          />
        )}
      </article>
    )
  }

  return (
    <section
      id="family-questions"
      className="family-questions"
      aria-labelledby="family-questions-title"
    >
      <header className="family-questions-heading">
        <div>
          <p className="panel-kicker">
            המעגל המשפחתי
          </p>

          <h2 id="family-questions-title">
            {pendingQuestions.length > 0
              ? 'יש שאלה חדשה מהמשפחה'
              : 'איזה סיפור המשפחה רוצה לשמוע?'}
          </h2>

          <p>
            שומרים שאלה אנושית אחת, ואז אפשר לענות עליה בקול ובזמן שנוח ל{subjectName}.
          </p>
        </div>

        <span className="family-questions-count">
          {pendingQuestions.length}
          {' '}
          ממתינות
        </span>
      </header>

      <details
        className="family-question-composer"
        onToggle={(event) => {
          if (event.currentTarget.open) {
            window.requestAnimationFrame(() => {
              document
                .getElementById(
                  'family-question-input',
                )
                ?.focus()
            })
          }
        }}
      >
        <summary data-aura-tooltip="לפתוח טופס לשאלה משפחתית חדשה">
          <span>הוספת שאלה משפחתית</span>
          <span aria-hidden="true">+</span>
        </summary>

        <form
          className="family-question-form"
          onSubmit={handleSubmit}
          aria-busy={isSubmitting}
        >
          <label htmlFor="family-question-input">
            שאלה חדשה ל{subjectName}
          </label>

          <div>
            <textarea
              id="family-question-input"
              value={draft}
              onChange={(event) =>
                setDraft(event.target.value)
              }
              minLength={5}
              maxLength={500}
              rows={3}
              placeholder={
                subjectGender === 'female'
                  ? `לדוגמה: ${subjectName}, מה הרגע הראשון שאת זוכרת מבית הילדות?`
                  : subjectGender === 'male'
                    ? `לדוגמה: ${subjectName}, מה הרגע הראשון שאתה זוכר מבית הילדות?`
                    : `לדוגמה: ${subjectName}, מהו הזיכרון הראשון מבית הילדות?`
              }
              required
            />

            <button
              className="primary-button"
              type="submit"
              data-aura-tooltip="לשמור את השאלה בזיכרון המשפחתי"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'שומרים את השאלה...'
                : 'שמירת השאלה'}
            </button>
          </div>

          <small>
            תוכן השאלה נשמר בתוך הזיכרון ואינו נשלח לשירות חיצוני.
          </small>
        </form>
      </details>

      {errorMessage && (
        <p
          className="form-error family-questions-message"
          role="alert"
        >
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p
          className="story-success family-questions-message"
          role="status"
        >
          {successMessage}
        </p>
      )}

      {isLoading ? (
        <div
          className="family-questions-loading"
          aria-live="polite"
        >
          <span
            className="loading-indicator"
            aria-hidden="true"
          />
          <p>טוענים שאלות מהמשפחה...</p>
        </div>
      ) : questions.length === 0 ? (
        <div className="family-questions-empty">
          <strong>
            עדיין אין שאלה שממתינה לתשובה
          </strong>

          <p>
            אפשר להתחיל בשאלה קצרה שתפתח סיפור משפחתי אמיתי.
          </p>
        </div>
      ) : (
        <div className="family-question-list">
          {questions
            .slice(0, 3)
            .map(renderQuestionCard)}

          {questions.length > 3 && (
            <details className="family-question-list-more">
              <summary data-aura-tooltip="לפתוח את כל שאלות המשפחה">
                הצגת כל השאלות
                {' · '}
                {questions.length - 3} נוספות
              </summary>

              <div>
                {questions
                  .slice(3)
                  .map(renderQuestionCard)}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  )
}

export default FamilyQuestions
