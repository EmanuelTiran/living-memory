import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router'
import {
  ApiError,
  refreshSession,
} from '../../api/authApi.js'
import {
  acceptMemoryInvitation,
  previewMemoryInvitation,
} from '../../api/familyAccessApi.js'
import './InvitationAcceptPage.css'

const roleLabels = {
  viewer: 'צפייה ושאלות',
  contributor: 'תיעוד סיפורים והקלטות',
  editor: 'עריכת חומרי הארכיון',
  steward: 'ניהול המעגל המשפחתי',
}

function getInvitationErrorMessage(error) {
  if (!(error instanceof ApiError)) {
    return 'אירעה שגיאה בלתי צפויה.'
  }

  const messages = {
    MEMORY_INVITATION_UNAVAILABLE:
      'ההזמנה אינה זמינה, בוטלה או שפג תוקפה.',
    MEMORY_INVITATION_EMAIL_MISMATCH:
      'ההזמנה מיועדת לכתובת אימייל אחרת. יש להתחבר לחשבון המתאים.',
    VALIDATION_ERROR:
      'יש לאשר את כל סעיפי ההסכמה לפני ההצטרפות.',
    NETWORK_ERROR:
      'לא הצלחנו להתחבר לשרת.',
  }

  return (
    messages[error.code] ??
    'לא הצלחנו לקבל את ההזמנה.'
  )
}

function InvitationAcceptPage({
  authentication,
  onAuthenticationChange,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const token = useMemo(() => {
    const parameters = new URLSearchParams(
      location.hash.slice(1),
    )

    return parameters.get('token') ?? ''
  }, [location.hash])

  const [invitation, setInvitation] =
    useState(null)
  const [consent, setConsent] = useState({
    acceptsArchiveParticipation: false,
    acceptsRecordingAndTranscription:
      false,
    understandsGroundedAiUse: false,
  })
  const [isLoading, setIsLoading] =
    useState(Boolean(token))
  const [isSubmitting, setIsSubmitting] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState(
      token
        ? ''
        : 'קישור ההזמנה חסר או אינו תקין.',
    )

  const returnTo =
    `/invitation${location.hash}`

  useEffect(() => {
    let isActive = true

    if (!token) {
      return undefined
    }

    previewMemoryInvitation(token)
      .then((result) => {
        if (isActive) {
          setInvitation(result)
          setErrorMessage('')
        }
      })
      .catch((error) => {
        if (isActive) {
          setErrorMessage(
            getInvitationErrorMessage(error),
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
  }, [token])

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

          const restoredAuthentication =
            await refreshSession()

          onAuthenticationChange(
            restoredAuthentication,
          )

          return operation(
            restoredAuthentication.accessToken,
          )
        }
      },
      [
        authentication,
        onAuthenticationChange,
      ],
    )

  function handleConsentChange(event) {
    const { name, checked } = event.target

    setConsent((current) => ({
      ...current,
      [name]: checked,
    }))
  }

  async function handleAccept(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const result =
        await runAuthenticatedRequest(
          (accessToken) =>
            acceptMemoryInvitation(
              accessToken,
              {
                token,
                consent: {
                  policyVersion:
                    invitation
                      .consentPolicyVersion,
                  ...consent,
                },
              },
            ),
        )

      navigate(
        `/app/memories/${result.memoryProfile.id}`,
        {
          replace: true,
          state: {
            invitationAccepted: true,
          },
        },
      )
    } catch (error) {
      setErrorMessage(
        getInvitationErrorMessage(error),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page-shell">
      <section
        className="surface-card invitation-page"
        aria-labelledby="invitation-title"
      >
        <Link className="back-link" to="/">
          חזרה לעמוד הראשי
        </Link>

        <div className="invitation-heading">
          <p className="eyebrow">
            הזמנה משפחתית אישית
          </p>
          <h1 id="invitation-title">
            הוזמנתם לשמור סיפור משפחתי
          </h1>

          <p>
            נכנסים בקישור אחד, מאשרים מה מתאים לכם, ואז אפשר
            לספר בקול או להשאיר שאלה. אין שאלון שצריך להשלים.
          </p>
        </div>

        {isLoading ? (
          <div
            className="invitation-loading"
            aria-live="polite"
          >
            <span
              className="loading-indicator"
              aria-hidden="true"
            />
            <p>בודקים את ההזמנה...</p>
          </div>
        ) : errorMessage && !invitation ? (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        ) : invitation ? (
          <>
            <section className="invitation-summary">
              <p>הוזמנת אל הארכיון של</p>
              <h2>{invitation.subjectName}</h2>
              <dl>
                <div>
                  <dt>התפקיד המוצע</dt>
                  <dd>
                    {roleLabels[invitation.role]}
                  </dd>
                </div>
                <div>
                  <dt>החשבון המיועד</dt>
                  <dd dir="ltr">
                    {invitation.invitedEmailHint}
                  </dd>
                </div>
              </dl>
            </section>

            {!authentication?.user ? (
              <section className="invitation-auth-actions">
                <h2>
                  קודם מתחברים עם האימייל
                  שאליו נשלחה ההזמנה
                </h2>
                <p>
                  אין צורך להתקין אפליקציה.
                  לאחר ההתחברות תחזרו ישירות
                  לכאן.
                </p>
                <div>
                  <Link
                    className="primary-button"
                    to="/login"
                    state={{ returnTo }}
                  >
                    כניסה לחשבון
                  </Link>
                  <Link
                    className="secondary-button"
                    to="/register"
                    state={{
                      returnTo,
                      invitationToken: token,
                    }}
                  >
                    יצירת חשבון
                  </Link>
                </div>
              </section>
            ) : (
              <form
                className="participation-consent"
                onSubmit={handleAccept}
              >
                <div>
                  <p className="panel-kicker">
                    הסכמה מפורשת
                  </p>
                  <h2>
                    לפני הכניסה, חשוב להבין
                    למה מסכימים
                  </h2>
                  <p>
                    ההסכמה הזאת נוגעת לארכיון,
                    להקלטה ולתשובות מבוססות מקור
                    בלבד. היא אינה אישור לשכפול
                    קול או ליצירת אווטאר.
                  </p>
                </div>

                <label>
                  <input
                    type="checkbox"
                    name="acceptsArchiveParticipation"
                    checked={
                      consent.acceptsArchiveParticipation
                    }
                    onChange={handleConsentChange}
                    required
                  />
                  <span>
                    אני מסכים/ה להצטרף לארכיון
                    המשפחתי הפרטי בתפקיד המוצג.
                  </span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    name="acceptsRecordingAndTranscription"
                    checked={
                      consent.acceptsRecordingAndTranscription
                    }
                    onChange={handleConsentChange}
                    required
                  />
                  <span>
                    אני מבין/ה שאם אקליט, הקול
                    יתומלל ויישמר לצד המקור לצורך
                    הארכיון.
                  </span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    name="understandsGroundedAiUse"
                    checked={
                      consent.understandsGroundedAiUse
                    }
                    onChange={handleConsentChange}
                    required
                  />
                  <span>
                    אני מבין/ה שתשובות AI יוכלו
                    להסתמך רק על מקורות משפחתיים
                    שאושרו ולהפנות אליהם.
                  </span>
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
                  className="primary-button"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'מצרפים לארכיון...'
                    : 'אישור ההסכמה והצטרפות'}
                </button>
              </form>
            )}
          </>
        ) : null}
      </section>
    </main>
  )
}

export default InvitationAcceptPage
