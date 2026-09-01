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
import {
  pilotAvatarEnabled,
  pilotInviteOnly,
} from './config/pilotFeatures.js'
import AdminDashboard from './features/admin/AdminDashboard.jsx'
import MemoryChatPage from './features/chat/MemoryChatPage.jsx'
import FamilyAccessPage from './features/memories/FamilyAccessPage.jsx'
import InvitationAcceptPage from './features/memories/InvitationAcceptPage.jsx'
import MemoryDashboard from './features/memories/MemoryDashboard.jsx'
import MemoryPilotPage from './features/memories/MemoryPilotPage.jsx'
import MemoryPricingPilotPage from './features/memories/MemoryPricingPilotPage.jsx'
import MemoryProfilePage from './features/memories/MemoryProfilePage.jsx'
import './App.css'

const principles = [
  {
    title: 'הסיפור קודם לטכנולוגיה',
    description:
      'מתחילים בשיחה קצרה, שומרים את הקול ובודקים את הסיפור לפני שהוא נכנס לארכיון.',
  },
  {
    title: 'מקור שאפשר לחזור אליו',
    description:
      'תשובות הארכיון נשענות על סיפורים מאושרים ומפנות בחזרה למקור המשפחתי.',
  },
  {
    title: 'בשליטה משפחתית',
    description:
      'החומרים נשארים פרטיים כברירת מחדל, והמשפחה מחליטה מה לאשר ולשתף.',
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
    REGISTRATION_INVITATION_REQUIRED:
      'ההרשמה לפיילוט זמינה דרך קישור הזמנה אישי בלבד.',
    REGISTRATION_INVITATION_INVALID:
      'ההזמנה אינה תקינה, פגה או מיועדת לכתובת אימייל אחרת.',
    AUTH_RATE_LIMITED:
      'בוצעו יותר מדי ניסיונות בזמן קצר. המתינו מעט ונסו שוב.',
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

function getSafeReturnTo(value) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//')
  ) {
    return '/app'
  }

  return value
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

        <p className="eyebrow">Living Memory · זיכרון חי</p>

        <h1
          className="hero-title"
          id="welcome-title"
        >
          הסיפורים של המשפחה שלכם.
          <span>
            בקולם. מוכנים לשאלה הבאה.
          </span>
        </h1>

        <p className="lead">
          תעדו אותם בשיחות קצרות וטבעיות,
          בנו ארכיון משפחתי חי ושאלו אותו
          שאלות שמבוססות על מה שנאמר באמת.
        </p>

        <div className="hero-actions">
          {user ? (
            <Link
              className="primary-button"
              to="/app"
              data-aura-tooltip="לפתוח את הזיכרונות המשפחתיים שלך"
            >
              פתיחת הארכיון המשפחתי
            </Link>
          ) : (
            pilotInviteOnly ? (
              <Link
                className="primary-button"
                to="/login"
                data-aura-tooltip="להתחבר לחשבון הפיילוט הפרטי"
              >
                כניסה לפיילוט הפרטי
              </Link>
            ) : (
              <>
                <Link
                  className="primary-button"
                  to="/register"
                  data-aura-tooltip="ליצור חשבון וארכיון משפחתי"
                >
                  התחלת ארכיון משפחתי
                </Link>

                <Link
                  className="secondary-button"
                  to="/login"
                  data-aura-tooltip="להתחבר לחשבון קיים"
                >
                  כניסה לחשבון
                </Link>
              </>
            )
          )}
        </div>

        {pilotInviteOnly && !user && (
          <p className="private-pilot-notice">
            הפיילוט נפתח כעת למספר מצומצם של
            משפחות ובהזמנה אישית בלבד.
          </p>
        )}

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
            ה־AI אינו מחליף את האדם ואינו
            ממציא מה הוא היה אומר. התשובות
            מסומנות לפי רמת הביסוס שלהן;
            שכבות קול מלאכותי
            {pilotAvatarEnabled
              ? ' ואווטאר'
              : ''}{' '}
            הן אפשרויות נפרדות בלבד.
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
  const returnTo = getSafeReturnTo(
    location.state?.returnTo,
  )
  const registrationTokenCandidate =
    location.state?.invitationToken
  const invitationToken =
    typeof registrationTokenCandidate ===
    'string'
      ? registrationTokenCandidate
      : ''

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
          invitationToken:
            invitationToken || undefined,
        })

        navigate('/login', {
          replace: true,
          state: {
            registrationCompleted: true,
            email: formData.email.trim(),
            returnTo,
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

      navigate(returnTo, {
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

  if (
    isRegistration &&
    pilotInviteOnly &&
    !invitationToken
  ) {
    return (
      <PageShell>
        <section
          className="surface-card auth-card registration-closed-card"
          aria-labelledby="auth-title"
        >
          <Link
            className="back-link"
            to="/"
            data-aura-tooltip="לחזור לעמוד הפתיחה"
          >
            חזרה לעמוד הראשי
          </Link>

          <div className="brand-line" aria-hidden="true" />
          <p className="eyebrow">פיילוט פרטי</p>
          <h1 className="auth-title" id="auth-title">
            ההרשמה נפתחת בהזמנה בלבד
          </h1>
          <p className="auth-description">
            כדי ליצור חשבון חדש יש לפתוח את קישור
            ההזמנה האישי שקיבלתם ממנהל הארכיון
            המשפחתי. אם כבר נרשמתם, אפשר להתחבר.
          </p>
          <Link
            className="primary-button"
            to="/login"
            data-aura-tooltip="להתחבר לחשבון קיים"
          >
            כניסה לחשבון קיים
          </Link>
        </section>
      </PageShell>
    )
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
          data-aura-tooltip="לחזור לעמוד הפתיחה"
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

        {(!pilotInviteOnly || isRegistration) && (
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
              state={{
                returnTo,
                invitationToken,
              }}
              data-aura-tooltip={
                isRegistration
                  ? 'לעבור לכניסה לחשבון קיים'
                  : 'לעבור ליצירת חשבון חדש'
              }
            >
              {isRegistration
                ? 'כניסה לחשבון'
                : 'יצירת חשבון'}
            </Link>
          </p>
        )}
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
        path="/invitation"
        element={
          initializing ? (
            <LoadingScreen />
          ) : (
            <InvitationAcceptPage
              authentication={
                authentication
              }
              onAuthenticationChange={
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
        path="/app/admin"
        element={
          initializing ? (
            <LoadingScreen />
          ) : authentication?.user?.systemRole ===
            'admin' ? (
            <AdminDashboard
              authentication={
                authentication
              }
              onAuthenticationChange={
                setAuthentication
              }
            />
          ) : authentication?.user ? (
            <Navigate to="/app" replace />
          ) : (
            <Navigate to="/login" replace />
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
        path="/app/memories/:memoryId/family"
        element={
          initializing ? (
            <LoadingScreen />
          ) : authentication?.user ? (
            <FamilyAccessPage
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
        path="/app/memories/:memoryId/pilot"
        element={
          initializing ? (
            <LoadingScreen />
          ) : authentication?.user ? (
            <MemoryPilotPage
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
        path="/app/memories/:memoryId/pricing-pilot"
        element={
          initializing ? (
            <LoadingScreen />
          ) : authentication?.user ? (
            <MemoryPricingPilotPage
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
