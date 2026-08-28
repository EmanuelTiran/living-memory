import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import {
  Link,
  useNavigate,
} from 'react-router'
import {
  getAdminOverview,
  getAdminPilotOverview,
  getAdminPricingPilotOverview,
  updatePricingPilotParticipant,
} from '../../api/adminApi.js'
import {
  ApiError,
  refreshSession,
} from '../../api/authApi.js'
import './AdminDashboard.css'
import PricingPilotAdminPanel from './PricingPilotAdminPanel.jsx'

const numberFormatter =
  new Intl.NumberFormat('he-IL')

const jobTypeLabels = {
  memory_asset_parse:
    'ניתוח תמונה או מסמך',
  recording_transcription:
    'תמלול הקלטה',
}

const resourceTypeLabels = {
  memory_asset: 'קובץ ארכיון',
  memory_recording: 'הקלטה',
}

function formatNumber(value) {
  return numberFormatter.format(
    Number.isFinite(value) ? value : 0,
  )
}

function formatDateTime(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'לא ידוע'
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      dateStyle: 'short',
      timeStyle: 'short',
    },
  ).format(date)
}

function formatRate(value) {
  return value === null ||
    !Number.isFinite(value)
    ? 'אין עדיין בסיס לחישוב'
    : `${value}%`
}

async function getAdminDashboardData(
  accessToken,
) {
  const [overview, pilot, pricingPilot] =
    await Promise.all([
      getAdminOverview(accessToken),
      getAdminPilotOverview(accessToken),
      getAdminPricingPilotOverview(
        accessToken,
      ),
    ])

  return {
    overview,
    pilot,
    pricingPilot,
  }
}

function getAdminErrorMessage(error) {
  if (!(error instanceof ApiError)) {
    return 'אירעה שגיאה בלתי צפויה.'
  }

  const messages = {
    ADMIN_ACCESS_REQUIRED:
      'אין לחשבון הזה הרשאת מנהל פעילה.',
    AUTHENTICATION_REQUIRED:
      'החיבור הסתיים. יש להתחבר מחדש.',
    NETWORK_ERROR:
      'לא הצלחנו להתחבר לשרת.',
  }

  return (
    messages[error.code] ??
    'לא הצלחנו לטעון את תמונת המצב.'
  )
}

function MetricCard({ label, value, note }) {
  return (
    <article className="admin-metric-card">
      <p>{label}</p>
      <strong>{formatNumber(value)}</strong>
      {note && <span>{note}</span>}
    </article>
  )
}

function SourceRow({ label, source }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{formatNumber(source.total)}</td>
      <td>{formatNumber(source.approved)}</td>
      <td>{formatNumber(source.draft)}</td>
      <td>{formatNumber(source.archived)}</td>
    </tr>
  )
}

function AdminDashboard({
  authentication,
  onAuthenticationChange,
}) {
  const navigate = useNavigate()
  const [overview, setOverview] =
    useState(null)
  const [pilot, setPilot] = useState(null)
  const [pricingPilot, setPricingPilot] =
    useState(null)
  const [isLoading, setIsLoading] =
    useState(true)
  const [errorMessage, setErrorMessage] =
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

  const loadOverview = useCallback(
    async () => {
      try {
        const dashboardData =
          await runAuthenticatedRequest(
            getAdminDashboardData,
          )

        setOverview(dashboardData.overview)
        setPilot(dashboardData.pilot)
        setPricingPilot(
          dashboardData.pricingPilot,
        )
        setErrorMessage('')
      } catch (error) {
        setErrorMessage(
          getAdminErrorMessage(error),
        )
      } finally {
        setIsLoading(false)
      }
    },
    [runAuthenticatedRequest],
  )

  useEffect(() => {
    let isActive = true

    runAuthenticatedRequest(
      getAdminDashboardData,
    )
      .then((dashboardData) => {
        if (isActive) {
          setOverview(
            dashboardData.overview,
          )
          setPilot(dashboardData.pilot)
          setPricingPilot(
            dashboardData.pricingPilot,
          )
          setErrorMessage('')
        }
      })
      .catch((error) => {
        if (isActive) {
          setErrorMessage(
            getAdminErrorMessage(error),
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
  }, [runAuthenticatedRequest])

  const sources = overview?.sources
  const processing = overview?.processing

  async function handlePaymentAction({
    participantCode,
    evidenceReference,
    action,
  }) {
    const participant =
      await runAuthenticatedRequest(
        (accessToken) =>
          updatePricingPilotParticipant(
            accessToken,
            participantCode,
            action,
            evidenceReference,
          ),
      )

    const nextPricingPilot =
      await runAuthenticatedRequest(
        getAdminPricingPilotOverview,
      )

    setPricingPilot(nextPricingPilot)
    return participant
  }

  return (
    <main className="page-shell">
      <section
        className="surface-card admin-dashboard"
        aria-labelledby="admin-title"
      >
        <header className="admin-dashboard-header">
          <div>
            <p className="eyebrow">
              ניהול ודיווח
            </p>
            <h1 id="admin-title">
              תמונת מצב תפעולית
            </h1>
            <p>
              נתונים מצטברים בלבד, ללא
              חשיפת תוכן פרטי מהארכיון.
            </p>
          </div>

          <div className="admin-header-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setIsLoading(true)
                setErrorMessage('')
                void loadOverview()
              }}
              disabled={isLoading}
            >
              {isLoading
                ? 'מרעננים...'
                : 'רענון נתונים'}
            </button>

            <Link
              className="secondary-button"
              to="/app"
            >
              חזרה לאזור האישי
            </Link>
          </div>
        </header>

        <aside className="admin-privacy-note">
          <strong>גבול פרטיות</strong>
          <p>
            הלוח אינו טוען שמות, אימיילים,
            סיפורים, תמלילים, תיאורים או
            קבצים. תקלות מוצגות באמצעות קוד
            טכני בלבד.
          </p>
        </aside>

        {errorMessage && (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        )}

        {isLoading && !overview ? (
          <div
            className="admin-loading"
            aria-live="polite"
          >
            <span
              className="loading-indicator"
              aria-hidden="true"
            />
            <p>טוענים תמונת מצב...</p>
          </div>
        ) : overview ? (
          <>
            <section
              className="admin-section"
              aria-labelledby="admin-summary-title"
            >
              <div className="admin-section-heading">
                <div>
                  <p className="panel-kicker">
                    מצב כללי
                  </p>
                  <h2 id="admin-summary-title">
                    הארכיון במספרים
                  </h2>
                </div>
                <span>
                  עודכן {formatDateTime(
                    overview.generatedAt,
                  )}
                </span>
              </div>

              <div className="admin-metric-grid">
                <MetricCard
                  label="חשבונות פעילים"
                  value={overview.accounts.active}
                  note={`${formatNumber(
                    overview.accounts.suspended,
                  )} מושעים`}
                />
                <MetricCard
                  label="פרופילי זיכרון פעילים"
                  value={overview.memories.active}
                  note={`${formatNumber(
                    overview.memories.archived,
                  )} בארכיון`}
                />
                <MetricCard
                  label="מקורות מאושרים"
                  value={sources.approved}
                  note={`${formatNumber(
                    sources.draft,
                  )} ממתינים לבדיקה`}
                />
                <MetricCard
                  label="עבודות הדורשות תשומת לב"
                  value={processing.needsAttention}
                  note={`${formatNumber(
                    processing.backlog,
                  )} בתור או בעיבוד`}
                />
              </div>
            </section>

            {pilot && (
              <section
                className="admin-section"
                aria-labelledby="admin-pilot-title"
              >
                <div className="admin-section-heading">
                  <div>
                    <p className="panel-kicker">
                      פיילוט התנהגותי
                    </p>
                    <h2 id="admin-pilot-title">
                      משפך ההפעלה המשפחתי
                    </h2>
                  </div>
                  <span>
                    מדדים מצטברים ללא תוכן פרטי
                  </span>
                </div>

                <div className="admin-metric-grid">
                  <MetricCard
                    label="הזמנות שנוצרו"
                    value={pilot.invitations.sent}
                    note={`${formatNumber(
                      pilot.invitations.accepted,
                    )} התקבלו · ${formatRate(
                      pilot.invitations
                        .acceptanceRatePercent,
                    )}`}
                  />
                  <MetricCard
                    label="הסכמות שהושלמו"
                    value={pilot.consent.completed}
                    note={formatRate(
                      pilot.consent
                        .completionRatePercent,
                    )}
                  />
                  <MetricCard
                    label="ארכיונים עם סיפור ראשון"
                    value={
                      pilot.capture
                        .firstStoryMemories
                    }
                    note={formatRate(
                      pilot.capture
                        .firstStoryCompletionRatePercent,
                    )}
                  />
                  <MetricCard
                    label="ארכיונים עם 3 מפגשים"
                    value={
                      pilot.capture
                        .threeSessionMemories
                    }
                    note={formatRate(
                      pilot.capture
                        .threeSessionRatePercent,
                    )}
                  />
                </div>

                <div className="admin-pilot-detail-grid">
                  <article>
                    <strong>
                      {formatNumber(
                        pilot.invitations.pending,
                      )}
                    </strong>
                    <span>הזמנות ממתינות</span>
                  </article>
                  <article>
                    <strong>
                      {formatNumber(
                        pilot.invitations.expired,
                      )}
                    </strong>
                    <span>הזמנות שפג תוקפן</span>
                  </article>
                  <article>
                    <strong>
                      {formatNumber(
                        pilot.familyLoop
                          .memoriesWithFamilyQuestions,
                      )}
                    </strong>
                    <span>
                      ארכיונים עם שאלת משפחה
                    </span>
                  </article>
                  <article>
                    <strong>
                      {formatRate(
                        pilot.familyLoop
                          .returnRatePercent,
                      )}
                    </strong>
                    <span>חזרת משפחה לשאלה</span>
                  </article>
                </div>

                {pilot.behavioral && (
                  <div className="admin-behavioral-pilot">
                    <div className="admin-section-heading">
                      <div>
                        <p className="panel-kicker">
                          ארבעה שבועות
                        </p>
                        <h3>
                          מדדי ההתנהגות של המחקר
                        </h3>
                      </div>
                      <span>
                        רק פעולות משמעותיות בפועל
                      </span>
                    </div>

                    <div className="admin-metric-grid">
                      <MetricCard
                        label="ארכיונים שנרשמו"
                        value={
                          pilot.behavioral
                            .cohort.enrolled
                        }
                        note={`${formatNumber(
                          pilot.behavioral
                            .cohort.active,
                        )} פעילים · ${formatNumber(
                          pilot.behavioral
                            .cohort.completed,
                        )} השלימו חלון`}
                      />
                      <MetricCard
                        label="אינטראקציות משפחתיות משמעותיות"
                        value={
                          pilot.behavioral
                            .northStar
                            .meaningfulFamilyInteractions
                        }
                        note={
                          pilot.behavioral
                            .northStar
                            .averagePerParticipatingMemory ===
                          null
                            ? 'אין עדיין בסיס לחישוב'
                            : `${pilot.behavioral.northStar.averagePerParticipatingMemory} בממוצע לארכיון`
                        }
                      />
                      <MetricCard
                        label="הלולאה המשפחתית הושלמה"
                        value={
                          pilot.behavioral
                            .coreLoop.completed
                        }
                        note={`${formatRate(
                          pilot.behavioral
                            .coreLoop
                            .completionRatePercent,
                        )} מתוך ${formatNumber(
                          pilot.behavioral
                            .coreLoop.eligible,
                        )} זכאים`}
                      />
                      <MetricCard
                        label="השתתפות שהופסקה"
                        value={
                          pilot.behavioral
                            .cohort.withdrawn
                        }
                        note="תוכן הארכיון אינו נמחק"
                      />
                    </div>

                    <div className="admin-pilot-gates">
                      {[
                        {
                          key:
                            'threeContributionWeeks',
                          label:
                            'תיעוד ב־3 מתוך 4 שבועות',
                        },
                        {
                          key:
                            'familyReturnByWeekTwo',
                          label:
                            'חזרת משפחה עד שבוע 2',
                        },
                        {
                          key:
                            'twoFamilyQuestionWeeks',
                          label:
                            'שאלות בשבועיים שונים',
                        },
                        {
                          key:
                            'd30HouseholdActive',
                          label:
                            'משק בית פעיל סביב יום 30',
                        },
                      ].map((gateDefinition) => {
                        const gate =
                          pilot.behavioral.gates[
                            gateDefinition.key
                          ]

                        return (
                          <article
                            key={gateDefinition.key}
                          >
                            <span>
                              {gateDefinition.label}
                            </span>
                            <strong>
                              {formatRate(
                                gate.ratePercent,
                              )}
                            </strong>
                            <small>
                              יעד מחקר: {gate.targetPercent}%
                              {' · '}
                              {formatNumber(gate.met)} מתוך{' '}
                              {formatNumber(
                                gate.eligible,
                              )} זכאים
                            </small>
                          </article>
                        )
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}

            {pricingPilot && (
              <PricingPilotAdminPanel
                pricingPilot={pricingPilot}
                formatNumber={formatNumber}
                formatRate={formatRate}
                onPaymentAction={
                  handlePaymentAction
                }
              />
            )}

            <section
              className="admin-section"
              aria-labelledby="admin-activity-title"
            >
              <div className="admin-section-heading">
                <div>
                  <p className="panel-kicker">
                    24 השעות האחרונות
                  </p>
                  <h2 id="admin-activity-title">
                    פעילות מערכת
                  </h2>
                </div>
              </div>

              <div className="admin-metric-grid compact">
                <MetricCard
                  label="חשבונות חדשים"
                  value={
                    overview
                      .activityLast24Hours
                      .newUsers
                  }
                />
                <MetricCard
                  label="זיכרונות חדשים"
                  value={
                    overview
                      .activityLast24Hours
                      .newMemories
                  }
                />
                <MetricCard
                  label="עיבודים שהושלמו"
                  value={
                    overview
                      .activityLast24Hours
                      .completedJobs
                  }
                />
                <MetricCard
                  label="עיבודים שנכשלו"
                  value={
                    overview
                      .activityLast24Hours
                      .failedJobs
                  }
                />
              </div>
            </section>

            <section
              className="admin-section"
              aria-labelledby="admin-sources-title"
            >
              <div className="admin-section-heading">
                <div>
                  <p className="panel-kicker">
                    איכות הארכיון
                  </p>
                  <h2 id="admin-sources-title">
                    מצב המקורות
                  </h2>
                </div>
              </div>

              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">סוג מקור</th>
                      <th scope="col">סה״כ</th>
                      <th scope="col">מאושר</th>
                      <th scope="col">טיוטה</th>
                      <th scope="col">בארכיון</th>
                    </tr>
                  </thead>
                  <tbody>
                    <SourceRow
                      label="סיפורים"
                      source={
                        sources.byType.stories
                      }
                    />
                    <SourceRow
                      label="תשובות ביוגרפיות"
                      source={
                        sources.byType
                          .biographyAnswers
                      }
                    />
                    <SourceRow
                      label="תמלילי הקלטות"
                      source={
                        sources.byType
                          .recordingTranscripts
                      }
                    />
                  </tbody>
                </table>
              </div>
            </section>

            <section
              className="admin-section"
              aria-labelledby="admin-processing-title"
            >
              <div className="admin-section-heading">
                <div>
                  <p className="panel-kicker">
                    Worker
                  </p>
                  <h2 id="admin-processing-title">
                    עבודות עיבוד
                  </h2>
                </div>
              </div>

              <div className="admin-processing-summary">
                <span>
                  {formatNumber(
                    processing.queued,
                  )} בהמתנה
                </span>
                <span>
                  {formatNumber(
                    processing.processing,
                  )} בעיבוד
                </span>
                <span>
                  {formatNumber(
                    processing.completed,
                  )} הושלמו
                </span>
                <span>
                  {formatNumber(
                    processing.failed,
                  )} נכשלו
                </span>
                <span>
                  {formatNumber(
                    processing.stalled,
                  )} עם lease שפג
                </span>
              </div>

              {processing.recentFailures.length > 0 ? (
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th scope="col">עבודה</th>
                        <th scope="col">משאב</th>
                        <th scope="col">ניסיונות</th>
                        <th scope="col">קוד שגיאה</th>
                        <th scope="col">עודכן</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processing.recentFailures.map(
                        (failure, index) => (
                          <tr
                            key={`${failure.jobType}-${failure.updatedAt}-${index}`}
                          >
                            <td>
                              {jobTypeLabels[
                                failure.jobType
                              ] ?? failure.jobType}
                            </td>
                            <td>
                              {resourceTypeLabels[
                                failure.resourceType
                              ] ?? failure.resourceType}
                            </td>
                            <td>
                              {formatNumber(
                                failure.attemptCount,
                              )}
                              {' / '}
                              {formatNumber(
                                failure.maxAttempts,
                              )}
                            </td>
                            <td dir="ltr">
                              <code>
                                {failure.lastErrorCode}
                              </code>
                            </td>
                            <td>
                              {formatDateTime(
                                failure.updatedAt,
                              )}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="admin-healthy-state">
                  לא נמצאו עבודות עיבוד שנכשלו.
                </p>
              )}
            </section>
          </>
        ) : null}
      </section>
    </main>
  )
}

export default AdminDashboard
