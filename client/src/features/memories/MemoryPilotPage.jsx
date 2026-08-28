import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import {
  Link,
  useNavigate,
  useParams,
} from 'react-router'
import {
  ApiError,
  refreshSession,
} from '../../api/authApi.js'
import {
  getMemoryPilot,
  startMemoryPilot,
  withdrawMemoryPilot,
} from '../../api/familyAccessApi.js'
import './MemoryPilotPage.css'

function formatDate(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'לא ידוע'
  }

  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'medium',
  }).format(date)
}

function getPilotErrorMessage(error) {
  if (!(error instanceof ApiError)) {
    return 'אירעה שגיאה בלתי צפויה.'
  }

  const messages = {
    MEMORY_NOT_FOUND:
      'הארכיון לא נמצא או שאין לך גישה אליו.',
    MEMORY_PILOT_NOT_ACTIVE:
      'הפיילוט הזה כבר הסתיים או הופסק.',
    AUTHENTICATION_REQUIRED:
      'החיבור הסתיים. יש להתחבר מחדש.',
    NETWORK_ERROR:
      'לא הצלחנו להתחבר לשרת.',
  }

  return (
    messages[error.code] ??
    'לא הצלחנו להשלים את הפעולה.'
  )
}

function GateCard({
  title,
  description,
  gate,
  countLabel,
}) {
  const state = gate.met
    ? 'completed'
    : gate.eligible
      ? 'missed'
      : 'active'
  const stateLabel = gate.met
    ? 'היעד הושלם'
    : gate.eligible
      ? 'החלון הסתיים'
      : 'בתהליך'

  return (
    <article
      className={`pilot-gate pilot-gate-${state}`}
    >
      <span className="pilot-gate-state">
        {stateLabel}
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {countLabel && (
        <strong>{countLabel}</strong>
      )}
    </article>
  )
}

function MemoryPilotPage({
  authentication,
  onAuthenticationChange,
}) {
  const { memoryId } = useParams()
  const navigate = useNavigate()
  const [pilotData, setPilotData] =
    useState(null)
  const [isLoading, setIsLoading] =
    useState(true)
  const [isSubmitting, setIsSubmitting] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState('')
  const [successMessage, setSuccessMessage] =
    useState('')

  const runAuthenticatedRequest =
    useCallback(
      async (operation) => {
        try {
          return await operation(
            authentication.accessToken,
          )
        } catch (error) {
          if (
            !(error instanceof ApiError) ||
            error.statusCode !== 401
          ) {
            throw error
          }

          try {
            const restoredAuthentication =
              await refreshSession()

            onAuthenticationChange(
              restoredAuthentication,
            )

            return await operation(
              restoredAuthentication.accessToken,
            )
          } catch (refreshError) {
            onAuthenticationChange(null)
            navigate('/login', {
              replace: true,
            })
            throw refreshError
          }
        }
      },
      [
        authentication.accessToken,
        navigate,
        onAuthenticationChange,
      ],
    )

  const loadPilot = useCallback(
    async () => {
      const result =
        await runAuthenticatedRequest(
          (accessToken) =>
            getMemoryPilot(
              accessToken,
              memoryId,
            ),
        )

      setPilotData(result)
    },
    [memoryId, runAuthenticatedRequest],
  )

  useEffect(() => {
    let isActive = true

    runAuthenticatedRequest(
      (accessToken) =>
        getMemoryPilot(
          accessToken,
          memoryId,
        ),
    )
      .then((result) => {
        if (isActive) {
          setPilotData(result)
          setErrorMessage('')
        }
      })
      .catch((error) => {
        if (isActive) {
          setErrorMessage(
            getPilotErrorMessage(error),
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
  }, [
    memoryId,
    runAuthenticatedRequest,
  ])

  async function handleStart() {
    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const result =
        await runAuthenticatedRequest(
          (accessToken) =>
            startMemoryPilot(
              accessToken,
              memoryId,
            ),
        )

      setPilotData(result)
      setSuccessMessage(
        'הפיילוט התחיל. השבוע הראשון פתוח לתיעוד קצר.',
      )
    } catch (error) {
      setErrorMessage(
        getPilotErrorMessage(error),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleWithdraw() {
    const confirmed = window.confirm(
      'להפסיק את ההשתתפות בפיילוט? תוכן הארכיון לא יימחק.',
    )

    if (!confirmed) {
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const result =
        await runAuthenticatedRequest(
          (accessToken) =>
            withdrawMemoryPilot(
              accessToken,
              memoryId,
            ),
        )

      setPilotData(result)
      setSuccessMessage(
        'ההשתתפות בפיילוט הופסקה. תוכן הארכיון נשאר ללא שינוי.',
      )
    } catch (error) {
      setErrorMessage(
        getPilotErrorMessage(error),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const pilot = pilotData?.pilot
  const enrollment = pilot?.enrollment
  const gates = pilot?.gates
  const isActive =
    enrollment?.phase === 'active'

  return (
    <main className="page-shell">
      <section
        className="surface-card memory-pilot-page"
        aria-labelledby="pilot-title"
      >
        <header className="pilot-header">
          <div>
            <p className="eyebrow">
              שלב 15 · פיילוט התנהגותי
            </p>
            <h1 id="pilot-title">
              ארבעה שבועות של זיכרון חי
            </h1>
            <p>
              בודקים הרגל משפחתי אמיתי:
              תיעוד קצר, חזרה של בן משפחה
              ושאלה שמחברת בחזרה למקור.
            </p>
          </div>

          <Link
            className="secondary-button"
            to={`/app/memories/${memoryId}`}
          >
            חזרה לפרופיל
          </Link>
        </header>

        <aside className="pilot-measurement-note">
          <strong>מה נספר?</strong>
          <p>
            רק מפגש תיעוד שהושלם, סיפור
            שאושר או שאלה אמיתית של בן
            משפחה. פתיחת האפליקציה אינה
            נחשבת הצלחה.
          </p>
        </aside>

        {errorMessage && (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        )}

        {successMessage && (
          <p
            className="form-success"
            role="status"
          >
            {successMessage}
          </p>
        )}

        {isLoading ? (
          <div
            className="pilot-loading"
            aria-live="polite"
          >
            <span
              className="loading-indicator"
              aria-hidden="true"
            />
            <p>טוענים את מצב הפיילוט...</p>
          </div>
        ) : !pilot ? (
          <section className="pilot-start-panel">
            <p className="panel-kicker">
              לפני שמתחילים
            </p>
            <h2>
              מסלול קטן עם יעדים ברורים
            </h2>
            <ul>
              <li>
                תיעוד בשלושה שבועות שונים
                מתוך ארבעה.
              </li>
              <li>
                חזרת בן משפחה ושאלה עד סוף
                השבוע השני.
              </li>
              <li>
                שאלות משפחה בשני שבועות
                שונים.
              </li>
              <li>
                פעילות משמעותית גם בשבוע
                הרביעי.
              </li>
            </ul>

            {pilotData?.canManage ? (
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  void handleStart()
                }}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? 'מתחילים...'
                  : 'התחלת הפיילוט עכשיו'}
              </button>
            ) : (
              <p className="pilot-owner-note">
                בעל הארכיון או הנאמן המשפחתי
                יכולים להתחיל את המסלול.
              </p>
            )}
          </section>
        ) : (
          <>
            <section className="pilot-status-strip">
              <div>
                <span>מצב</span>
                <strong>
                  {enrollment.phase === 'active'
                    ? 'הפיילוט פעיל'
                    : enrollment.phase ===
                        'completed'
                      ? 'חלון ארבעת השבועות הסתיים'
                      : 'ההשתתפות הופסקה'}
                </strong>
              </div>
              <div>
                <span>התחלה</span>
                <strong>
                  {formatDate(
                    enrollment.startedAt,
                  )}
                </strong>
              </div>
              <div>
                <span>סיום</span>
                <strong>
                  {formatDate(
                    enrollment.endsAt,
                  )}
                </strong>
              </div>
              <div>
                <span>פעולות משמעותיות</span>
                <strong>
                  {
                    pilot.progress
                      .meaningfulInteractionCount
                  }
                </strong>
              </div>
            </section>

            {isActive && (
              <p className="pilot-days-remaining">
                נשארו {enrollment.daysRemaining}{' '}
                ימים בחלון הפיילוט.
              </p>
            )}

            <section
              className="pilot-section"
              aria-labelledby="pilot-gates-title"
            >
              <div className="pilot-section-heading">
                <p className="panel-kicker">
                  מדדי המחקר
                </p>
                <h2 id="pilot-gates-title">
                  ארבעה שערי הצלחה
                </h2>
              </div>

              <div className="pilot-gate-grid">
                <GateCard
                  title="תיעוד חוזר"
                  description="פעילות תיעוד בשלושה שבועות שונים."
                  gate={
                    gates.threeContributionWeeks
                  }
                  countLabel={`${gates.threeContributionWeeks.count} מתוך ${gates.threeContributionWeeks.target} שבועות`}
                />
                <GateCard
                  title="חזרת המשפחה"
                  description="בן משפחה שאינו המספר שאל שאלה עד סוף שבוע 2."
                  gate={
                    gates.familyReturnByWeekTwo
                  }
                />
                <GateCard
                  title="שיחה מתמשכת"
                  description="שאלות משפחה בשני שבועות שונים."
                  gate={
                    gates.twoFamilyQuestionWeeks
                  }
                  countLabel={`${gates.twoFamilyQuestionWeeks.count} מתוך ${gates.twoFamilyQuestionWeeks.target} שבועות`}
                />
                <GateCard
                  title="פעילות סביב יום 30"
                  description="פעולה משמעותית בשבעת הימים שלפני מדידת יום 30."
                  gate={
                    gates.d30HouseholdActive
                  }
                />
              </div>
            </section>

            <section
              className="pilot-section"
              aria-labelledby="pilot-weeks-title"
            >
              <div className="pilot-section-heading">
                <p className="panel-kicker">
                  מסלול שבועי
                </p>
                <h2 id="pilot-weeks-title">
                  ארבע שיחות קצרות
                </h2>
              </div>

              <div className="pilot-week-grid">
                {pilot.weeks.map((week) => (
                  <article
                    className={
                      week.isCurrent
                        ? 'pilot-week pilot-week-current'
                        : 'pilot-week'
                    }
                    key={week.week}
                  >
                    <div className="pilot-week-number">
                      שבוע {week.week}
                    </div>
                    <h3>{week.title}</h3>
                    <p>{week.prompt}</p>
                    <span>
                      {formatDate(week.startsAt)} –{' '}
                      {formatDate(week.endsAt)}
                    </span>
                    <dl>
                      <div>
                        <dt>תיעוד</dt>
                        <dd>
                          {week.contributionCount}
                        </dd>
                      </div>
                      <div>
                        <dt>שאלות משפחה</dt>
                        <dd>
                          {week.familyQuestionCount}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </section>

            <section className="pilot-actions-panel">
              <div>
                <p className="panel-kicker">
                  הפעולה הבאה
                </p>
                <h2>
                  ממשיכים מתוך הארכיון הקיים
                </h2>
              </div>
              <div className="pilot-actions">
                <Link
                  className="primary-button"
                  to={`/app/memories/${memoryId}`}
                >
                  הקלטת סיפור קצר
                </Link>
                <Link
                  className="secondary-button"
                  to={`/app/memories/${memoryId}/family`}
                >
                  צירוף בן משפחה
                </Link>
                <Link
                  className="secondary-button"
                  to={`/app/memories/${memoryId}/chat`}
                >
                  שאלת המשפחה
                </Link>
              </div>
            </section>

            {pilotData?.canManage && isActive && (
              <div className="pilot-withdraw-row">
                <button
                  className="pilot-withdraw-button"
                  type="button"
                  onClick={() => {
                    void handleWithdraw()
                  }}
                  disabled={isSubmitting}
                >
                  הפסקת השתתפות בפיילוט
                </button>
                <span>
                  הפעולה אינה מוחקת סיפורים,
                  הקלטות או הרשאות.
                </span>
              </div>
            )}
          </>
        )}

        {!isLoading && pilot && (
          <button
            className="pilot-refresh-button"
            type="button"
            onClick={() => {
              setIsLoading(true)
              setErrorMessage('')
              void loadPilot()
                .catch((error) => {
                  setErrorMessage(
                    getPilotErrorMessage(error),
                  )
                })
                .finally(() => {
                  setIsLoading(false)
                })
            }}
          >
            רענון ההתקדמות
          </button>
        )}
      </section>
    </main>
  )
}

export default MemoryPilotPage
