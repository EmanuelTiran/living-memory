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
import BrandLogo from './BrandLogo.jsx'
import './App.css'

const archiveItems = [
  {
    title: 'סיפורים ופרטי חיים',
    description:
      'זיכרונות מהילדות, אנשים משמעותיים, מקומות ותחנות בדרך — עם השמות והפרטים שעוזרים להבין את הסיפור.',
  },
  {
    title: 'הקלטות ותמלולים',
    description:
      'הקול המקורי, עם המילים והדרך שבה נאמרו. תמלולים עוברים בדיקה ואישור בנפרד מההקלטה.',
  },
  {
    title: 'תמונות וחומרים משפחתיים',
    description:
      'תמונות וחומרים משפחתיים נשמרים לצד הסיפורים שאליהם הם שייכים.',
  },
  {
    title: 'שאלות מהמשפחה',
    description:
      'מה תמיד רציתם לשאול? שומרים גם את השאלות שעוד מחכות לסיפור שלהן.',
  },
]

const processSteps = [
  {
    title: 'בוחרים מאיפה להתחיל',
    description:
      'שאלה מהמשפחה, סיפור שרוצים לשמור או ראיון חיים מודרך שעוזר למצוא את המילים.',
  },
  {
    title: 'מתעדים ובודקים',
    description:
      'מקליטים, כותבים או מוסיפים תמונה. עוברים על הטיוטות והתמלולים לפני שמאשרים אותם.',
  },
  {
    title: 'חוזרים ומוסיפים',
    description:
      'מקשיבים שוב, קוראים יחד ומוסיפים פרטים וסיפורים לאורך השנים. בהדרגה נבנה ארכיון של מורשת משפחתית.',
  },
]

const conversationFeatures = [
  {
    title: 'שאלות שמחזירות לסיפור',
    description:
      'השיחה מחברת בין השאלה לחומרים הרלוונטיים בארכיון. כשהמידע קיים, אפשר לחזור גם אל המקור שממנו התשובה נשענת.',
  },
  {
    title: 'תשובות בקול מותאם',
    description:
      'למי שיבחרו בכך, אפשר להוסיף שכבה של קול מלאכותי המותאם להקלטות של האדם שסיפורו נשמר. ההקלטות המקוריות נשארות נפרדות מהדיבור שנוצר.',
  },
  {
    title: 'גם עם אווטאר',
    description:
      'אווטאר חזותי יכול להוסיף נוכחות לחוויית השיחה — כשכבה אופציונלית נוספת.',
  },
]

const trustPrinciples = [
  {
    title: 'אתם בוחרים מה לאשר ואת מי לשתף',
    description:
      'המשפחה מנהלת את הגישה לארכיון ואת התכנים המאושרים בו.',
  },
  {
    title: 'טיוטה נשארת טיוטה עד לאישור',
    description:
      'תמלולים וטיוטות נבדקים לפני שהם הופכים לחלק המאושר של הארכיון.',
  },
  {
    title: 'מקור שאפשר לחזור אליו',
    description:
      'ההקלטה המקורית והחומרים שנשמרו נשארים לצד העיבודים שלהם, כדי שאפשר יהיה לחזור להקשר שבו תועד הסיפור.',
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

function PageShell({ children, className = '' }) {
  const classes = ['page-shell', className]
    .filter(Boolean)
    .join(' ')

  return (
    <main className={classes}>
      {children}
    </main>
  )
}

function AuthFrame() {
  return (
    <div className="auth-frame" aria-hidden="true">
      <span className="auth-frame-segment auth-frame-ink" />
      <span className="auth-frame-segment auth-frame-clay" />
      <span className="auth-frame-segment auth-frame-olive" />
    </div>
  )
}

function LoadingScreen() {
  return (
    <PageShell>
      <section
        className="surface-card loading-card"
        aria-live="polite"
      >
        <span className="loading-brand" aria-hidden="true">
          <img src="/favicon-32x32.png" alt="" />
        </span>

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
  const primaryAction = user
    ? {
        label: 'פתיחת הארכיון המשפחתי',
        to: '/app',
        tooltip: 'לפתוח את הזיכרונות המשפחתיים שלך',
      }
    : pilotInviteOnly
      ? {
          label: 'כניסה לפיילוט הפרטי',
          to: '/login',
          tooltip: 'להתחבר לחשבון הפיילוט הפרטי',
        }
      : {
          label: 'התחלת ארכיון משפחתי',
          to: '/register',
          tooltip: 'ליצור חשבון וארכיון משפחתי',
        }

  return (
    <PageShell className="home-page-shell">
      <section
        className="home-hero"
        aria-labelledby="home-title"
      >
        <div className="home-hero-brand">
          <BrandLogo className="home-brand-logo" />
          <span className="home-brand-divider" aria-hidden="true" />
          <span className="home-brand-english" dir="ltr">
            Living Memory
          </span>
        </div>

        <div className="home-hero-layout">
          <div className="home-hero-copy">
            <p className="home-eyebrow">
              זיכרון חי — ארכיון משפחתי לסיפורי חיים
            </p>

            <h1 className="home-title" id="home-title">
              <span>הסיפורים של המשפחה שלכם.</span>
              <span>במילים שלהם. בקול שלהם.</span>
            </h1>

            <p className="home-lead">
              שומרים סיפורי חיים, הקלטות ותמונות בארכיון משפחתי אחד,
              כדי שתוכלו לחזור לסיפורים ולשתף אותם גם עם הדורות הבאים.
              מתחילים בזיכרון אחד, ומוסיפים עוד עם הזמן.
            </p>

            <p className="home-trust-line">
              <span aria-hidden="true">✓</span>
              אתם בוחרים מה לאשר ואת מי לשתף.
            </p>

            <div className="home-actions">
              <Link
                className="primary-button"
                to={primaryAction.to}
                data-aura-tooltip={primaryAction.tooltip}
              >
                {primaryAction.label}
              </Link>

              <a
                className="secondary-button"
                href="#how-it-works"
                data-aura-tooltip="לעבור להסבר על תהליך התיעוד"
              >
                איך זה עובד
              </a>
            </div>

            {!user && !pilotInviteOnly && (
              <Link
                className="home-account-link"
                to="/login"
                data-aura-tooltip="להתחבר לחשבון קיים"
              >
                כבר יש לכם חשבון? כניסה לחשבון
              </Link>
            )}

            {pilotInviteOnly && (
              <p className="home-pilot-notice">
                זיכרון חי פועל כעת בפיילוט פרטי ומצומצם.
                ההצטרפות בהזמנה בלבד.
              </p>
            )}

            {(initializing || startupError) && (
              <p
                className={
                  startupError
                    ? 'development-status status-error'
                    : 'development-status'
                }
                aria-live="polite"
              >
                <span aria-hidden="true" />
                {startupError || 'בודקים אם קיים חיבור פעיל'}
              </p>
            )}
          </div>

          <aside
            className="home-archive-preview"
            aria-label="המחשה של ארכיון משפחתי"
          >
            <div className="home-preview-heading">
              <span>ארכיון משפחתי</span>
              <span aria-hidden="true">01</span>
            </div>

            <div className="home-preview-story">
              <span className="home-preview-label">סיפור חיים</span>
              <strong>הזיכרון נשמר עם הפרטים שנותנים לו משמעות</strong>
              <span className="home-preview-lines" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </div>

            <div className="home-preview-source">
              <span className="home-preview-play" aria-hidden="true">
                ▶
              </span>
              <span>
                <strong>הקלטה מקורית</strong>
                <small>נשמרת לצד התמלול המאושר</small>
              </span>
              <span className="home-preview-wave" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
            </div>

            <div className="home-preview-footer">
              <span>סיפורים</span>
              <span>הקלטות</span>
              <span>תמונות</span>
              <span>שאלות</span>
            </div>
          </aside>
        </div>

        <aside className="home-advanced-preview">
          <span className="home-advanced-mark" aria-hidden="true">
            AI
          </span>
          <p>
            בהמשך אפשר יהיה גם לשאול על הזיכרונות שנשמרו,
            ולבחור לשמוע תשובות בקול מלאכותי מותאם
            או לחוות את השיחה באמצעות אווטאר.
          </p>
        </aside>
      </section>

      <section
        className="home-section"
        aria-labelledby="archive-section-title"
      >
        <div className="home-section-intro">
          <div>
            <p className="home-section-label">הארכיון המשפחתי</p>
            <h2 id="archive-section-title">הסיפור שמאחורי התמונות</h2>
            <p className="home-section-lead">
              זיכרון חי הוא ארכיון משפחתי שבו שומרים את סיפורי החיים,
              הזיכרונות והקול של בני המשפחה, כדי שאפשר יהיה לחזור אליהם
              ולהעביר אותם לדורות הבאים.
            </p>
          </div>

          <p className="home-section-support">
            לצד תמונה אפשר לשמור מי מופיע בה ומה קרה באותו יום.
            לצד סיפור כתוב — את ההקלטה שבה סופר.
            כך נשמרים גם הפרטים שנותנים לזיכרון את המשמעות שלו.
          </p>
        </div>

        <ol className="archive-items">
          {archiveItems.map((item, index) => (
            <li key={item.title}>
              <span className="home-item-number" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="home-section process-section"
        id="how-it-works"
        tabIndex={-1}
        aria-labelledby="process-section-title"
      >
        <div className="home-centered-intro">
          <p className="home-section-label">תהליך פשוט ומתמשך</p>
          <h2 id="process-section-title">מתחילים מסיפור אחד</h2>
          <p>
            אין צורך לתעד חיים שלמים בבת אחת.
            אפשר להתחיל משאלה, מתמונה או מזיכרון שעולה בשיחה.
          </p>
        </div>

        <ol className="process-steps">
          {processSteps.map((step, index) => (
            <li key={step.title}>
              <span className="process-step-number" aria-hidden="true">
                {index + 1}
              </span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="home-section experience-section"
        aria-labelledby="experience-section-title"
      >
        <div className="experience-glow" aria-hidden="true" />
        <div className="experience-intro">
          <p className="experience-label">שיחה, קול מותאם ואווטאר</p>
          <h2 id="experience-section-title">
            <span>לשאול על הסיפורים.</span>
            <span>לשמוע אותם בדרך נוספת.</span>
          </h2>
          <p>
            הארכיון נועד להיות גם בסיס לשיחה על מה שתועד.
            ככל שנשמרים בו סיפורים ומקורות מאושרים,
            אפשר לבנות חוויה שבה שואלים שאלות בשפה טבעית
            ומקבלים תשובות המבוססות על החומרים שנשמרו.
          </p>
        </div>

        <ul className="conversation-prompts" aria-label="דוגמאות לשאלות">
          <li>איך נראו החיים בבית שבו גדלו?</li>
          <li>מה הם סיפרו על הילדות?</li>
          <li>מה עמד מאחורי החלטה משפחתית חשובה?</li>
        </ul>

        <div className="experience-features">
          {conversationFeatures.map((feature, index) => (
            <article key={feature.title}>
              <span aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>

        <aside className="experience-disclosure" aria-label="הבהרה חשובה">
          <span className="experience-disclosure-mark" aria-hidden="true">
            AI
          </span>
          <p>
            <strong>
              הקול המלאכותי והאווטאר הם ייצוגים שנוצרים באמצעות בינה מלאכותית,
              ולא האדם עצמו.
            </strong>
            אפשר לשמור, לקרוא ולהקשיב לסיפורים גם בלעדיהם.
          </p>
        </aside>
      </section>

      <section
        className="home-section"
        aria-labelledby="trust-section-title"
      >
        <div className="home-centered-intro">
          <p className="home-section-label">בחירה, אישור ומקור</p>
          <h2 id="trust-section-title">הסיפור קודם לטכנולוגיה</h2>
        </div>

        <ol className="trust-principles">
          {trustPrinciples.map((principle, index) => (
            <li key={principle.title}>
              <span aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3>{principle.title}</h3>
              <p>{principle.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="home-section final-cta-section"
        aria-labelledby="final-cta-title"
      >
        <div className="final-cta-copy">
          <p className="home-section-label">הצעד הראשון</p>
          <h2 id="final-cta-title">איזה סיפור תרצו לשמור ראשון?</h2>
          <p>
            סיפור מהילדות, זיכרון משפחתי
            או השאלה שתמיד רציתם לשאול.
            אפשר להתחיל משם.
          </p>

          {pilotInviteOnly && (
            <p className="final-pilot-note">
              זיכרון חי נמצא כעת בפיילוט פרטי ומצומצם.
              ההצטרפות בהזמנה בלבד.
            </p>
          )}

          {!user && pilotInviteOnly && (
            <p className="final-login-hint">
              יש לכם הזמנה? התחברו לחשבון כדי להתחיל.
            </p>
          )}
        </div>

        <Link
          className="primary-button final-cta-button"
          to={primaryAction.to}
          data-aura-tooltip={primaryAction.tooltip}
        >
          {primaryAction.label}
        </Link>
      </section>

      <footer className="home-footer">
        <p>
          <strong>זיכרון חי</strong>
          <span aria-hidden="true"> | </span>
          <span dir="ltr">Living Memory</span>
        </p>
        <p>שומרים סיפורי חיים לדורות.</p>
      </footer>
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
      <PageShell className="auth-page-shell">
        <section
          className="surface-card auth-card registration-closed-card"
          aria-labelledby="auth-title"
        >
          <AuthFrame />

          <Link
            className="back-link"
            to="/"
            data-aura-tooltip="לחזור לעמוד הפתיחה"
          >
            חזרה לעמוד הראשי
          </Link>

          <BrandLogo className="auth-brand-logo" compact />
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
    <PageShell className="auth-page-shell">
      <section
        className={`surface-card auth-card ${
          isRegistration
            ? 'auth-card-registration'
            : 'auth-card-login'
        }`}
        aria-labelledby="auth-title"
      >
        <AuthFrame />

        <Link
          className="back-link"
          to="/"
          data-aura-tooltip="לחזור לעמוד הפתיחה"
        >
          חזרה לעמוד הראשי
        </Link>

        <BrandLogo className="auth-brand-logo" compact />

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
