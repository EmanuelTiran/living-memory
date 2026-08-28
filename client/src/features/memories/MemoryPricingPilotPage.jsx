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
  createFounderOffer,
  getPricingPilot,
  updateFounderDecision,
} from '../../api/pricingPilotApi.js'
import FounderDepositOffer from './FounderDepositOffer.jsx'
import './MemoryPricingPilotPage.css'

function getPricingErrorMessage(error) {
  if (!(error instanceof ApiError)) {
    return 'אירעה שגיאה בלתי צפויה.'
  }

  const messages = {
    PRICING_PILOT_OWNER_REQUIRED:
      'רק בעל הארכיון יכול להצטרף לפיילוט התמחור.',
    BEHAVIORAL_PILOT_ENROLLMENT_REQUIRED:
      'יש להצטרף תחילה לפיילוט המשפחתי בן ארבעת השבועות.',
    FOUNDER_DEPOSIT_OFFER_REQUIRED:
      'יש לפתוח תחילה את הצעת המייסדים.',
    FOUNDER_DEPOSIT_DECISION_LOCKED:
      'לאחר אימות תשלום, שינוי או החזר נעשים מול מנהל הפיילוט.',
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

function MemoryPricingPilotPage({
  authentication,
  onAuthenticationChange,
}) {
  const { memoryId } = useParams()
  const navigate = useNavigate()
  const [pricingPilot, setPricingPilot] =
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
              restoredAuthentication
                .accessToken,
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

    runAuthenticatedRequest(
      (accessToken) =>
        getPricingPilot(
          accessToken,
          memoryId,
        ),
    )
      .then((result) => {
        if (isActive) {
          setPricingPilot(result)
          setErrorMessage('')
        }
      })
      .catch((error) => {
        if (isActive) {
          setErrorMessage(
            getPricingErrorMessage(error),
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

  async function handleOffer() {
    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const result =
        await runAuthenticatedRequest(
          (accessToken) =>
            createFounderOffer(
              accessToken,
              memoryId,
            ),
        )

      setPricingPilot({
        ...pricingPilot,
        ...result,
        eligibility: {
          eligible: true,
          reason: null,
        },
      })
      setSuccessMessage(
        'הצעת המייסדים נפתחה. לא בוצע חיוב.',
      )
    } catch (error) {
      setErrorMessage(
        getPricingErrorMessage(error),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDecision(decision) {
    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const result =
        await runAuthenticatedRequest(
          (accessToken) =>
            updateFounderDecision(
              accessToken,
              memoryId,
              decision,
            ),
        )

      setPricingPilot({
        ...pricingPilot,
        ...result,
      })
      setSuccessMessage(
        decision === 'interested'
          ? 'העניין נרשם. זה עדיין אינו תשלום; לאחר תשלום חיצוני מנהל הפיילוט יאמת אותו.'
          : 'הבחירה נשמרה. לא בוצע חיוב.',
      )
    } catch (error) {
      setErrorMessage(
        getPricingErrorMessage(error),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page-shell">
      <section
        className="surface-card pricing-pilot-page"
        aria-labelledby="pricing-pilot-title"
      >
        <header className="pricing-pilot-header">
          <div>
            <p className="eyebrow">
              שלב 16 · פיילוט תמחור
            </p>
            <h1 id="pricing-pilot-title">
              קבוצת המייסדים של זיכרון חי
            </h1>
            <p>
              בודקים נכונות אמיתית לשלם,
              בלי מנוי ובלי חיוב אוטומטי.
            </p>
          </div>

          <Link
            className="secondary-button"
            to={`/app/memories/${memoryId}`}
          >
            חזרה לפרופיל
          </Link>
        </header>

        <aside className="pricing-safety-note">
          <strong>אין גביית כרטיס במסך הזה</strong>
          <p>
            הבעת עניין אינה תשלום. תשלום
            נעשה מחוץ לאפליקציה בתיאום עם
            מנהל הפיילוט, ורק תשלום שנבדק
            בפועל מסומן כאן כשולם.
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
            className="pricing-pilot-loading"
            aria-live="polite"
          >
            <span
              className="loading-indicator"
              aria-hidden="true"
            />
            <p>טוענים את הצעת המייסדים...</p>
          </div>
        ) : pricingPilot ? (
          <FounderDepositOffer
            memoryId={memoryId}
            pricingPilot={pricingPilot}
            isSubmitting={isSubmitting}
            onOffer={() => {
              void handleOffer()
            }}
            onDecision={(decision) => {
              void handleDecision(decision)
            }}
          />
        ) : null}
      </section>
    </main>
  )
}

export default MemoryPricingPilotPage
