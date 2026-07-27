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
    ApiError,
    logoutSession,
    refreshSession,
  } from '../../api/authApi.js'
  import {
    createMemoryProfile,
    listMemoryProfiles,
  } from '../../api/memoryApi.js'
  import './MemoryDashboard.css'

  const emptyForm = {
    subjectName: '',
    relationship: '',
    description: '',
  }

  function getMemoryErrorMessage(error) {
    if (!(error instanceof ApiError)) {
      return 'אירעה שגיאה בלתי צפויה. נסו שוב.'
    }

    const messages = {
      VALIDATION_ERROR:
        'חלק מפרטי הזיכרון אינם תקינים.',
      AUTHENTICATION_REQUIRED:
        'החיבור לחשבון הסתיים. יש להתחבר מחדש.',
      NETWORK_ERROR:
        'לא הצלחנו להתחבר לשרת. ודאו שהוא פועל ונסו שוב.',
    }

    return (
      messages[error.code] ??
      'לא הצלחנו להשלים את הפעולה. נסו שוב.'
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

  function MemoryCard({ memoryProfile }) {
    return (
      <article className="memory-card">
        <div className="memory-card-header">
          <div>
            <p className="memory-privacy">
              זיכרון פרטי
            </p>

            <h3>
              {memoryProfile.subjectName}
            </h3>
          </div>

          <span
            className="memory-initial"
            aria-hidden="true"
          >
            {memoryProfile.subjectName
              .trim()
              .charAt(0)}
          </span>
        </div>

        {memoryProfile.relationship && (
          <p className="memory-relationship">
            {memoryProfile.relationship}
          </p>
        )}

        {memoryProfile.description ? (
          <p className="memory-description">
            {memoryProfile.description}
          </p>
        ) : (
          <p className="memory-description memory-description-empty">
            עדיין לא נוסף תיאור לזיכרון הזה.
          </p>
        )}

        {memoryProfile.createdAt && (
          <p className="memory-created-at">
            נוצר בתאריך{' '}
            {formatDate(
              memoryProfile.createdAt,
            )}
          </p>
        )}

        <Link
          className="dashboard-home-link"
          to={`/app/memories/${memoryProfile.id}`}
        >
          פתיחת הזיכרון
        </Link>
      </article>
    )
  }

  function MemoryDashboard({
    authentication,
    onAuthenticationChange,
  }) {
    const navigate = useNavigate()

    const [memoryProfiles, setMemoryProfiles] =
      useState([])

    const [formData, setFormData] =
      useState(emptyForm)

    const [showCreateForm, setShowCreateForm] =
      useState(false)

    const [isLoading, setIsLoading] =
      useState(true)

    const [isSubmitting, setIsSubmitting] =
      useState(false)

    const [isLoggingOut, setIsLoggingOut] =
      useState(false)

    const [errorMessage, setErrorMessage] =
      useState('')

    const [successMessage, setSuccessMessage] =
      useState('')

    const runAuthenticatedRequest = useCallback(
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

    useEffect(() => {
      let isActive = true

      async function loadMemoryProfiles() {
        setIsLoading(true)
        setErrorMessage('')

        try {
          const profiles =
            await runAuthenticatedRequest(
              listMemoryProfiles,
            )

          if (isActive) {
            setMemoryProfiles(profiles)
          }
        } catch (error) {
          if (isActive) {
            setErrorMessage(
              getMemoryErrorMessage(error),
            )
          }
        } finally {
          if (isActive) {
            setIsLoading(false)
          }
        }
      }

      loadMemoryProfiles()

      return () => {
        isActive = false
      }
    }, [runAuthenticatedRequest])

    function handleFormChange(event) {
      const { name, value } = event.target

      setFormData((current) => ({
        ...current,
        [name]: value,
      }))
    }

    async function handleCreateMemory(event) {
      event.preventDefault()
      setErrorMessage('')
      setSuccessMessage('')
      setIsSubmitting(true)

      try {
        const memoryProfile =
          await runAuthenticatedRequest(
            (accessToken) =>
              createMemoryProfile(
                accessToken,
                formData,
              ),
          )

        setMemoryProfiles((current) => [
          memoryProfile,
          ...current,
        ])

        setFormData(emptyForm)
        setShowCreateForm(false)

        setSuccessMessage(
          `הזיכרון של ${memoryProfile.subjectName} נוצר בהצלחה.`,
        )
      } catch (error) {
        setErrorMessage(
          getMemoryErrorMessage(error),
        )
      } finally {
        setIsSubmitting(false)
      }
    }

    async function handleLogout() {
      setErrorMessage('')
      setIsLoggingOut(true)

      try {
        await logoutSession()
        onAuthenticationChange(null)

        navigate('/', {
          replace: true,
        })
      } catch (error) {
        setErrorMessage(
          getMemoryErrorMessage(error),
        )
      } finally {
        setIsLoggingOut(false)
      }
    }

    const user = authentication.user

    return (
      <main className="page-shell">
        <section
          className="surface-card dashboard-card"
          aria-labelledby="dashboard-title"
        >
          <header className="dashboard-header">
            <div>
              <p className="eyebrow">
                האזור האישי
              </p>

              <h1
                className="dashboard-title"
                id="dashboard-title"
              >
                שלום, {user.displayName}
              </h1>

              <p>{user.email}</p>
            </div>

            <button
              className="secondary-button"
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut
                ? 'מתנתקים...'
                : 'התנתקות'}
            </button>
          </header>

          <div className="account-status">
            <span aria-hidden="true" />

            <div>
              <strong>
                החשבון מחובר ומאומת
              </strong>

              <p>
                הזיכרונות שתיצרו פרטיים
                כברירת מחדל ושייכים לחשבון
                שלכם בלבד.
              </p>
            </div>
          </div>

          <div className="memory-toolbar">
            <div>
              <p className="panel-kicker">
                הזיכרונות שלי
              </p>

              <h2>
                סיפורי החיים המשפחתיים
              </h2>
            </div>

            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setShowCreateForm(
                  (current) => !current,
                )

                setErrorMessage('')
                setSuccessMessage('')
              }}
            >
              {showCreateForm
                ? 'סגירת הטופס'
                : memoryProfiles.length > 0
                  ? 'יצירת זיכרון נוסף'
                  : 'יצירת זיכרון ראשון'}
            </button>
          </div>

          {showCreateForm && (
            <form
              className="memory-form"
              onSubmit={handleCreateMemory}
              aria-busy={isSubmitting}
            >
              <div className="memory-form-heading">
                <h2>יצירת זיכרון חדש</h2>

                <p>
                  התחילו בפרטים הבסיסיים.
                  סיפורים, תמונות והקלטות
                  יתווספו בשלבים הבאים.
                </p>
              </div>

              <div className="memory-form-grid">
                <label className="form-field">
                  <span>שם האדם</span>

                  <input
                    type="text"
                    name="subjectName"
                    value={
                      formData.subjectName
                    }
                    onChange={handleFormChange}
                    minLength={2}
                    maxLength={100}
                    autoFocus
                    required
                  />
                </label>

                <label className="form-field">
                  <span>
                    הקשר שלך לאדם
                  </span>

                  <input
                    type="text"
                    name="relationship"
                    value={
                      formData.relationship
                    }
                    onChange={handleFormChange}
                    maxLength={80}
                    placeholder="לדוגמה: סבתא, אבא, חבר"
                  />
                </label>
              </div>

              <label className="form-field">
                <span>תיאור קצר</span>

                <textarea
                  className="memory-textarea"
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  maxLength={1000}
                  rows={5}
                  placeholder="כמה מילים על האדם ועל הזיכרון שתרצו לשמר"
                />
              </label>

              <div className="memory-form-actions">
                <button
                  className="primary-button"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'שומרים...'
                    : 'שמירת הזיכרון'}
                </button>

                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false)
                    setFormData(emptyForm)
                  }}
                  disabled={isSubmitting}
                >
                  ביטול
                </button>
              </div>
            </form>
          )}

          {errorMessage && (
            <p
              className="form-error memory-message"
              role="alert"
            >
              {errorMessage}
            </p>
          )}

          {successMessage && (
            <p
              className="form-notice memory-message"
              role="status"
            >
              {successMessage}
            </p>
          )}

          {isLoading ? (
            <div
              className="memory-loading"
              aria-live="polite"
            >
              <span
                className="loading-indicator"
                aria-hidden="true"
              />

              <p>טוענים את הזיכרונות...</p>
            </div>
          ) : memoryProfiles.length === 0 ? (
            <section className="memory-empty-state">
              <div
                className="memory-empty-icon"
                aria-hidden="true"
              >
                +
              </div>

              <h2>
                עדיין לא יצרתם זיכרון
              </h2>

              <p>
                לחצו על “יצירת זיכרון ראשון”
                והתחילו בשם האדם ובכמה מילים
                עליו.
              </p>
            </section>
          ) : (
            <section
              className="memory-list"
              aria-label="רשימת הזיכרונות"
            >
              {memoryProfiles.map(
                (memoryProfile) => (
                  <MemoryCard
                    key={memoryProfile.id}
                    memoryProfile={
                      memoryProfile
                    }
                  />
                ),
              )}
            </section>
          )}

          <Link
            className="dashboard-home-link"
            to="/"
          >
            חזרה לעמוד הראשי
          </Link>
        </section>
      </main>
    )
  }

  export default MemoryDashboard
