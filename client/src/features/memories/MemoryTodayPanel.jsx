import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link } from 'react-router'
import {
  getBiographyQuestionnaire,
} from '../../api/biographyApi.js'
import {
  listFamilyQuestions,
} from '../../api/familyQuestionApi.js'
import {
  listMemoryRecordings,
} from '../../api/recordingApi.js'
import GuidedLivingJourney from './GuidedLivingJourney.jsx'
import {
  createMemoryProfileTabSearch,
  getMemoryProfileCapabilities,
  MEMORY_PROFILE_TAB_IDS,
} from './memoryProfileTabs.js'
import {
  deriveMemoryTodayState,
  MEMORY_TODAY_ACTION_KINDS,
} from './memoryTodayState.js'
import './MemoryTodayPanel.css'

function formatShortDate(value) {
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

function createTargetState(item) {
  return {
    memoryTodayTarget: {
      type: item.type ?? item.kind,
      id: item.targetId ?? item.id ?? '',
    },
    ...(item.startGuidedInterview
      ? {
          startGuidedInterview: true,
        }
      : {}),
  }
}

function getPrimaryActionTooltip(action) {
  const tooltips = {
    [MEMORY_TODAY_ACTION_KINDS.answerFamilyQuestion]:
      'להמשיך לשאלה המשפחתית שמחכה לך',
    [MEMORY_TODAY_ACTION_KINDS.reviewDraftStory]:
      'לבדוק ולאשר את טיוטת הסיפור',
    [MEMORY_TODAY_ACTION_KINDS.continueInterview]:
      'להמשיך מהמקום שבו השיחה נעצרה',
    [MEMORY_TODAY_ACTION_KINDS.addMemory]:
      'להוסיף זיכרון חדש לארכיון',
    [MEMORY_TODAY_ACTION_KINDS.viewStories]:
      'לפתוח את הסיפורים שנשמרו',
    [MEMORY_TODAY_ACTION_KINDS.askQuestion]:
      'להשאיר שאלה חדשה למשפחה',
  }

  return tooltips[action.kind] ?? ''
}

function MemoryTodayPanel({
  authorizationRole,
  currentSearch,
  isActive,
  memoryId,
  memoryStories,
  runAuthenticatedRequest,
  subjectName,
}) {
  const [familyQuestions, setFamilyQuestions] =
    useState([])
  const [recordings, setRecordings] =
    useState([])
  const [biographyProgress, setBiographyProgress] =
    useState(null)
  const [isLoading, setIsLoading] =
    useState(true)
  const [hasLoadError, setHasLoadError] =
    useState(false)
  const [loadVersion, setLoadVersion] =
    useState(0)
  const capabilities =
    getMemoryProfileCapabilities(
      authorizationRole,
    )

  useEffect(() => {
    if (!isActive) {
      return undefined
    }

    let isCurrent = true

    async function loadTodayContext() {
      setIsLoading(true)
      setHasLoadError(false)

      const requests = [
        runAuthenticatedRequest(
          (accessToken) =>
            listFamilyQuestions(
              accessToken,
              memoryId,
            ),
        ),
        runAuthenticatedRequest(
          (accessToken) =>
            listMemoryRecordings(
              accessToken,
              memoryId,
            ),
        ),
      ]

      if (capabilities.canManage) {
        requests.push(
          runAuthenticatedRequest(
            (accessToken) =>
              getBiographyQuestionnaire(
                accessToken,
                memoryId,
              ),
          ),
        )
      }

      const results =
        await Promise.allSettled(
          requests,
        )

      if (!isCurrent) {
        return
      }

      const [
        questionsResult,
        recordingsResult,
        biographyResult,
      ] = results

      if (
        questionsResult.status ===
        'fulfilled'
      ) {
        setFamilyQuestions(
          questionsResult.value,
        )
      }

      if (
        recordingsResult.status ===
        'fulfilled'
      ) {
        setRecordings(
          recordingsResult.value,
        )
      }

      if (
        biographyResult?.status ===
        'fulfilled'
      ) {
        setBiographyProgress(
          biographyResult.value
            ?.progress ?? null,
        )
      }

      setHasLoadError(
        results.some(
          (result) =>
            result.status ===
            'rejected',
        ),
      )
      setIsLoading(false)
    }

    void loadTodayContext()

    return () => {
      isCurrent = false
    }
  }, [
    authorizationRole,
    capabilities.canManage,
    isActive,
    loadVersion,
    memoryId,
    runAuthenticatedRequest,
  ])

  const todayState = useMemo(
    () =>
      deriveMemoryTodayState({
        authorizationRole,
        stories: memoryStories,
        recordings,
        familyQuestions,
        biographyProgress,
      }),
    [
      authorizationRole,
      biographyProgress,
      familyQuestions,
      memoryStories,
      recordings,
    ],
  )
  const countItems = [
    {
      key: 'approved-stories',
      label: 'סיפורים מאושרים',
      value:
        todayState.counts
          .approvedStories,
    },
    {
      key: 'draft-stories',
      label: 'טיוטות',
      value:
        todayState.counts.draftStories,
    },
    {
      key: 'pending-questions',
      label: 'שאלות ממתינות',
      value:
        todayState.counts
          .pendingFamilyQuestions,
    },
  ].filter((item) => item.value > 0)
  const primaryAction =
    todayState.primaryAction
  const profilePath =
    `/app/memories/${encodeURIComponent(memoryId)}`

  return (
    <section
      className="memory-today"
      aria-labelledby="memory-today-title"
    >
      <header className="memory-today-heading">
        <p className="panel-kicker">
          היום בזיכרון
        </p>

        <h2 id="memory-today-title">
          {todayState.isNewArchive
            ? `הארכיון של ${subjectName} נפתח`
            : `ממשיכים לשמור את הסיפור של ${subjectName}`}
        </h2>

        <p>
          {todayState.isNewArchive
            ? 'עכשיו נשמור זיכרון ראשון — כמה דקות, שאלה אחת.'
            : 'בכל ביקור בוחרים פעולה משמעותית אחת. אין צורך להשלים הכול בבת אחת.'}
        </p>
      </header>

      {isLoading ? (
        <div
          className="memory-today-loading"
          aria-live="polite"
        >
          <span
            className="loading-indicator"
            aria-hidden="true"
          />
          <p>
            בודקים מה כדאי לעשות עכשיו...
          </p>
        </div>
      ) : (
        <>
          {hasLoadError && (
            <div
              className="memory-today-load-warning"
              role="status"
            >
              <p>
                חלק מהעדכונים לא נטענו. אפשר להמשיך, או לנסות לרענן את ההצעה.
              </p>

              <button
                className="secondary-button"
                type="button"
                data-aura-tooltip="לבדוק שוב מה כדאי לעשות עכשיו"
                onClick={() =>
                  setLoadVersion(
                    (current) =>
                      current + 1,
                  )
                }
              >
                בדיקה מחדש
              </button>
            </div>
          )}

          <article className="memory-today-primary-action">
            <div>
              <span>הפעולה הבאה</span>
              <h3>{primaryAction.label}</h3>
              <p>
                {primaryAction.description}
              </p>
            </div>

            <div className="memory-today-primary-buttons">
              <Link
                className="primary-button"
                data-aura-tooltip={
                  getPrimaryActionTooltip(
                    primaryAction,
                  )
                }
                to={{
                  pathname: profilePath,
                  search:
                    createMemoryProfileTabSearch(
                      currentSearch,
                      primaryAction.tab,
                    ),
                  hash: primaryAction.hash,
                }}
                state={
                  createTargetState(
                    primaryAction,
                  )
                }
              >
                {primaryAction.label}
              </Link>

              {todayState.isNewArchive &&
                capabilities.canManage && (
                <Link
                  className="memory-today-secondary-link"
                  data-aura-tooltip="לכתוב סיפור חדש במקום ראיון"
                  to={{
                    pathname: profilePath,
                    search:
                      createMemoryProfileTabSearch(
                        currentSearch,
                        MEMORY_PROFILE_TAB_IDS.documentation,
                      ),
                    hash: '#stories-title',
                  }}
                >
                  כתיבת סיפור במקום
                </Link>
              )}
            </div>
          </article>

          {countItems.length > 0 && (
            <dl
              className="memory-today-counts"
              aria-label="סיכום קצר של הזיכרון"
            >
              {countItems.map((item) => (
                <div key={item.key}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {todayState.recentItems.length >
            0 && (
            <section
              className="memory-today-recent"
              aria-labelledby="memory-today-recent-title"
            >
              <div>
                <p className="panel-kicker">
                  מה נשמר לאחרונה
                </p>
                <h3 id="memory-today-recent-title">
                  פריטים אחרונים
                </h3>
              </div>

              <ul>
                {todayState.recentItems.map(
                  (item) => (
                    <li
                      key={`${item.type}:${item.id}`}
                    >
                      <Link
                        data-aura-tooltip={`לפתוח ${item.typeLabel} בארכיון`}
                        to={{
                          pathname:
                            profilePath,
                          search:
                            createMemoryProfileTabSearch(
                              currentSearch,
                              item.tab,
                            ),
                          hash: item.hash,
                        }}
                        state={
                          createTargetState(
                            item,
                          )
                        }
                      >
                        <span>
                          {item.typeLabel}
                        </span>
                        <strong>
                          {item.title}
                        </strong>
                        {(item.updatedAt ||
                          item.createdAt) && (
                          <time
                            dateTime={
                              item.updatedAt ??
                              item.createdAt
                            }
                          >
                            {formatShortDate(
                              item.updatedAt ??
                                item.createdAt,
                            )}
                          </time>
                        )}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </section>
          )}

          <details className="memory-today-journey">
            <summary data-aura-tooltip="לראות את שלבי המסלול המשפחתי">
              איך המסלול המשפחתי עובד?
            </summary>

            <GuidedLivingJourney
              memoryId={memoryId}
              subjectName={subjectName}
              authorizationRole={
                authorizationRole
              }
              canUseGuidedInterview={
                capabilities.canManage
              }
            />
          </details>
        </>
      )}
    </section>
  )
}

export default MemoryTodayPanel
