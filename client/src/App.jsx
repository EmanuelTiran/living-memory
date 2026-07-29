import {
  useEffect,
  useState,
} from 'react'
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router'
import {
  ApiError,
  loginAccount,
  refreshSession,
  registerAccount,
} from './api/authApi.js'
import MemoryChatPage from './features/chat/MemoryChatPage.jsx'
import MemoryDashboard from './features/memories/MemoryDashboard.jsx'
import MemoryProfilePage from './features/memories/MemoryProfilePage.jsx'
import './App.css'

const principles = [
  {
    title: 'מבוסס מקורות',
    description:
      'הדמות תשתמש רק בחומרים שנמסרו, נבדקו ואושרו.',
  },
  {
    title: 'פרטי ומאובטח',
    description:
      'כל זיכרון יהיה פרטי כברירת מחדל ומופרד מזיכרונות אחרים.',
  },
  {
    title: 'אנושי ומכבד',
    description:
      'המערכת תשמור על גבולות ברורים ולא תציג את הדמות כאדם עצמו.',
  },
]

function getErrorMessage(error) {
  if (!(error instanceof ApiError)) {
    return 'אירעה שגיאה בלתי צפויה. נסו שוב.'
  }

  const messages = {
    EMAIL_ALREADY_REGISTERED:
      'כבר קיים חשבון עם כתובת האימייל הזאת.',
    INVALID_CREDENTIALS:
      'כתובת האימייל או הסיסמה אינם נכונים.',
    ACCOUNT_SUSPENDED:
      'החשבון הזה הושעה ואינו יכול להתחבר.',
    VALIDATION_ERROR:
      'חלק מהפרטים אינם תקינים. בדקו את הטופס ונסו שוב.',
    NETWORK_ERROR:
      'לא הצלחנו להתחבר לשרת. ודאו שהשרת פועל ונסו שוב.',
  }

  return (
    messages[error.code] ??
    'לא הצלחנו להשלים את הפעולה. נסו שוב.'
  )
}

function PageShell({ children }) {
  return (
    <main className="page-shell">
      {children}
    </main>
  )
}

function LoadingScreen() {
  return (
    <PageShell>
      <section
        className="surface-card loading-card"
        aria-live="polite"
      >
        <span
          className="loading-indicator"
          aria-hidden="true"
        />

        <p>בודקים את מצב ההתחברות...</p>
      </section>
    </PageShell>
  )
}

function HomePage({
  user,
  initializing,
  startupError,
}) {
  return (
    <PageShell>
      <section
        className="surface-card welcome-card"
        aria-labelledby="welcome-title"
      >
        <div
          className="brand-line"
          aria-hidden="true"
        />

        <p className="eyebrow">זיכרון חי</p>

        <h1
          className="hero-title"
          id="welcome-title"
        >
          שומרים סיפורי חיים
          <span>
            בכבוד, באחריות ובאמינות
          </span>
        </h1>

        <p className="lead">
          מקום משפחתי לשימור זיכרונות,
          סיפורים ומורשת — וליצירת שיחה
          אינטראקטיבית המבוססת על מקורות
          מאושרים.
        </p>

        <div className="hero-actions">
          {user ? (
            <Link
              className="primary-button"
              to="/app"
            >
              כניסה לאזור האישי
            </Link>
          ) : (
            <>
              <Link
                className="primary-button"
                to="/register"
              >
                יצירת חשבון
              </Link>

              <Link
                className="secondary-button"
                to="/login"
              >
                כניסה לחשבון
              </Link>
            </>
          )}
        </div>

        <aside
          className="ai-disclosure"
          aria-label="הבהרה חשובה"
        >
          <span
            className="disclosure-mark"
            aria-hidden="true"
          >
            AI
          </span>

          <p>
            זו תהיה דמות AI המבוססת על
            חומרים שנמסרו ואושרו. היא אינה
            האדם עצמו, ותשובותיה עשויות
            לכלול הסקות או טעויות.
          </p>
        </aside>

        <ul
          className="principles"
          aria-label="עקרונות המערכת"
        >
          {principles.map((principle) => (
            <li key={principle.title}>
              <h2>{principle.title}</h2>
              <p>{principle.description}</p>
            </li>
          ))}
        </ul>

        <p
          className={
            startupError
              ? 'development-status status-error'
              : 'development-status'
          }
          aria-live="polite"
        >
          <span aria-hidden="true" />

          {startupError ??
            (initializing
              ? 'בודקים אם קיים חיבור פעיל'
              : 'מערכת ההרשמה וההתחברות פעילה')}
        </p>
      </section>
    </PageShell>
  )
}

function AuthPage({
  mode,
  onAuthenticated,
}) {
  const isRegistration =
    mode === 'register'

  const navigate = useNavigate()
  const location = useLocation()

  const [formData, setFormData] = useState({
    displayName: '',
    email:
      typeof location.state?.email === 'string'
        ? location.state.email
        : '',
    password: '',
  })

  const [errorMessage, setErrorMessage] =
    useState('')

  const [isSubmitting, setIsSubmitting] =
    useState(false)

  const registrationCompleted =
    mode === 'login' &&
    location.state?.registrationCompleted ===
      true

  function handleChange(event) {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      if (isRegistration) {
        await registerAccount({
          displayName: formData.displayName,
          email: formData.email,
          password: formData.password,
        })

        navigate('/login', {
          replace: true,
          state: {
            registrationCompleted: true,
            email: formData.email.trim(),
          },
        })

        return
      }

      const authentication =
        await loginAccount({
          email: formData.email,
          password: formData.password,
        })

      onAuthenticated(authentication)

      navigate('/app', {
        replace: true,
      })
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PageShell>
      <section
        className="surface-card auth-card"
        aria-labelledby="auth-title"
      >
        <Link
          className="back-link"
          to="/"
        >
          חזרה לעמוד הראשי
        </Link>

        <div
          className="brand-line"
          aria-hidden="true"
        />

        <p className="eyebrow">
          זיכרון חי
        </p>

        <h1
          className="auth-title"
          id="auth-title"
        >
          {isRegistration
            ? 'יצירת חשבון חדש'
            : 'כניסה לחשבון'}
        </h1>

        <p className="auth-description">
          {isRegistration
            ? 'החשבון יאפשר לכם ליצור ולנהל מספר זיכרונות משפחתיים פרטיים.'
            : 'התחברו כדי להמשיך אל הזיכרונות והסיפורים המשפחתיים שלכם.'}
        </p>

        {registrationCompleted && (
          <p
            className="form-notice"
            role="status"
          >
            החשבון נוצר בהצלחה. כעת אפשר
            להתחבר.
          </p>
        )}

        <form
          className="auth-form"
          onSubmit={handleSubmit}
          aria-busy={isSubmitting}
        >
          {isRegistration && (
            <label className="form-field">
              <span>שם להצגה</span>

              <input
                type="text"
                name="displayName"
                value={formData.displayName}
                onChange={handleChange}
                minLength={2}
                maxLength={80}
                autoComplete="name"
                autoFocus
                required
              />
            </label>
          )}

          <label className="form-field">
            <span>כתובת אימייל</span>

            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              maxLength={254}
              autoComplete="email"
              autoFocus={!isRegistration}
              dir="ltr"
              required
            />
          </label>

          <label className="form-field">
            <span>סיסמה</span>

            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              minLength={
                isRegistration ? 15 : 1
              }
              maxLength={128}
              autoComplete={
                isRegistration
                  ? 'new-password'
                  : 'current-password'
              }
              dir="ltr"
              required
            />

            {isRegistration && (
              <small>
                יש להשתמש בסיסמה באורך
                15 תווים לפחות.
              </small>
            )}
          </label>

          {errorMessage && (
            <p
              className="form-error"
              role="alert"
            >
              {errorMessage}
            </p>
          )}

          <button
            className="primary-button submit-button"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'מתבצע...'
              : isRegistration
                ? 'יצירת החשבון'
                : 'כניסה'}
          </button>
        </form>

        <p className="auth-switch">
          {isRegistration
            ? 'כבר יש לכם חשבון?'
            : 'עדיין אין לכם חשבון?'}

          <Link
            to={
              isRegistration
                ? '/login'
                : '/register'
            }
          >
            {isRegistration
              ? 'כניסה לחשבון'
              : 'יצירת חשבון'}
          </Link>
        </p>
      </section>
    </PageShell>
  )
}

function App() {
  const [
    authentication,
    setAuthentication,
  ] = useState(null)

  const [initializing, setInitializing] =
    useState(true)

  const [startupError, setStartupError] =
    useState('')

  useEffect(() => {
    let isActive = true

    async function restoreSession() {
      try {
        const restoredAuthentication =
          await refreshSession()

        if (isActive) {
          setAuthentication(
            restoredAuthentication,
          )
        }
      } catch (error) {
        if (
          isActive &&
          error instanceof ApiError &&
          error.code !==
            'INVALID_REFRESH_TOKEN'
        ) {
          setStartupError(
            getErrorMessage(error),
          )
        }
      } finally {
        if (isActive) {
          setInitializing(false)
        }
      }
    }

    restoreSession()

    return () => {
      isActive = false
    }
  }, [])

  const memoryChatPage = (
    <MemoryChatPage
      authentication={authentication}
      onAuthenticationChange={
        setAuthentication
      }
    />
  )

  return (
    <Routes>
      <Route
        path="/"
        element={
          <HomePage
            user={authentication?.user}
            initializing={initializing}
            startupError={startupError}
          />
        }
      />

      <Route
        path="/login"
        element={
          initializing ? (
            <LoadingScreen />
          ) : authentication?.user ? (
            <Navigate
              to="/app"
              replace
            />
          ) : (
            <AuthPage
              key="login"
              mode="login"
              onAuthenticated={
                setAuthentication
              }
            />
          )
        }
      />

      <Route
        path="/register"
        element={
          initializing ? (
            <LoadingScreen />
          ) : authentication?.user ? (
            <Navigate
              to="/app"
              replace
            />
          ) : (
            <AuthPage
              key="register"
              mode="register"
              onAuthenticated={
                setAuthentication
              }
            />
          )
        }
      />

      <Route
        path="/app"
        element={
          initializing ? (
            <LoadingScreen />
          ) : authentication?.user ? (
            <MemoryDashboard
              authentication={
                authentication
              }
              onAuthenticationChange={
                setAuthentication
              }
            />
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

      <Route
        path="/app/memories/:memoryId"
        element={
          initializing ? (
            <LoadingScreen />
          ) : authentication?.user ? (
            <MemoryProfilePage
              authentication={
                authentication
              }
              onAuthenticationChange={
                setAuthentication
              }
            />
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

      <Route
        path="/app/memories/:memoryId/chat"
        element={
          initializing ? (
            <LoadingScreen />
          ) : authentication?.user ? (
            memoryChatPage
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

      <Route
        path="/app/memories/:memoryId/chat/:conversationId"
        element={
          initializing ? (
            <LoadingScreen />
          ) : authentication?.user ? (
            memoryChatPage
          ) : (
            <Navigate
              to="/login"
              replace
            />
          )
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />
    </Routes>
  )
}

export default App