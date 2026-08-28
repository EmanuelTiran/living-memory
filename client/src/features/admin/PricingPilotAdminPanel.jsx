import { useState } from 'react'
import './PricingPilotAdminPanel.css'

const evidenceLabels = {
  collecting: 'אוספים מדגם',
  success: 'עבר את יעד התשלום',
  pivot: 'מתחת לסף שינוי הכיוון',
  inconclusive: 'התוצאה עדיין לא מכריעה',
}

function formatMoney(
  amountMinor,
  currency,
) {
  return new Intl.NumberFormat(
    'he-IL',
    {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    },
  ).format(amountMinor / 100)
}

function PricingPilotAdminPanel({
  pricingPilot,
  formatNumber,
  formatRate,
  onPaymentAction,
}) {
  const [participantCode, setParticipantCode] =
    useState('')
  const [evidenceReference, setEvidenceReference] =
    useState('')
  const [isSubmitting, setIsSubmitting] =
    useState(false)
  const [actionError, setActionError] =
    useState('')
  const [actionMessage, setActionMessage] =
    useState('')

  async function handleAction(action) {
    setIsSubmitting(true)
    setActionError('')
    setActionMessage('')

    try {
      const participant =
        await onPaymentAction({
          participantCode:
            participantCode
              .trim()
              .toUpperCase(),
          evidenceReference:
            evidenceReference.trim(),
          action,
        })

      setActionMessage(
        action === 'verify_payment'
          ? `התשלום עבור הקוד ${participant.participantCode} אומת.`
          : `ההחזר עבור הקוד ${participant.participantCode} אומת.`,
      )
      setEvidenceReference('')
    } catch (error) {
      setActionError(
        error?.message ??
          'לא הצלחנו לעדכן את התשלום.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const funnel = pricingPilot.funnel
  const gate = pricingPilot.researchGate
  const offerAmount = formatMoney(
    pricingPilot.offer.amountMinor,
    pricingPilot.offer.currency,
  )

  return (
    <section
      className="admin-section"
      aria-labelledby="admin-pricing-title"
    >
      <div className="admin-section-heading">
        <div>
          <p className="panel-kicker">
            שלב 16 · פיילוט תמחור
          </p>
          <h2 id="admin-pricing-title">
            הוכחת נכונות לשלם
          </h2>
        </div>
        <span>
          {offerAmount} בר־החזר · ללא מנוי
        </span>
      </div>

      <div className="admin-metric-grid">
        <article className="admin-metric-card">
          <p>הצעות שנפתחו</p>
          <strong>
            {formatNumber(funnel.offered)}
          </strong>
          <span>
            יעד מדגם: {formatNumber(
              gate.qualifiedOffers,
            )}
          </span>
        </article>
        <article className="admin-metric-card">
          <p>הביעו עניין</p>
          <strong>
            {formatNumber(funnel.interested)}
          </strong>
          <span>
            {formatRate(
              funnel.interestRatePercent,
            )}
          </span>
        </article>
        <article className="admin-metric-card">
          <p>פיקדונות שאומתו</p>
          <strong>
            {formatNumber(
              funnel.verifiedPayments,
            )}
          </strong>
          <span>
            {formatRate(
              funnel.depositRatePercent,
            )} מההצעות
          </span>
        </article>
        <article className="admin-metric-card">
          <p>הוחזרו</p>
          <strong>
            {formatNumber(funnel.refunded)}
          </strong>
          <span>
            {formatMoney(
              pricingPilot.economics
                .retainedMinor,
              pricingPilot.economics.currency,
            )} נשארו לאחר החזרים
          </span>
        </article>
      </div>

      <div className="pricing-research-gate">
        <strong>
          {evidenceLabels[
            gate.evidenceStatus
          ] ?? gate.evidenceStatus}
        </strong>
        <span>
          הצלחה: לפחות {gate.successRatePercent}%
          {' · '}
          בחינת שינוי כיוון: פחות מ־{gate.pivotBelowPercent}%
        </span>
      </div>

      <form
        className="pricing-operations-form"
        onSubmit={(event) => {
          event.preventDefault()
          void handleAction('verify_payment')
        }}
        aria-busy={isSubmitting}
      >
        <div>
          <p className="panel-kicker">
            אימות ידני מבוקר
          </p>
          <h3>עדכון לפי קוד משתתף</h3>
          <p>
            אין כאן שמות או אימיילים. האסמכתה
            נשמרת כטביעת SHA-256 בלבד ואינה
            מוחזרת ללוח.
          </p>
        </div>

        <label>
          <span>קוד משתתף</span>
          <input
            type="text"
            value={participantCode}
            onChange={(event) => {
              setParticipantCode(
                event.target.value,
              )
            }}
            minLength={16}
            maxLength={16}
            pattern="[A-Fa-f0-9]{16}"
            dir="ltr"
            autoComplete="off"
            required
          />
        </label>

        <label>
          <span>אסמכתת תשלום או החזר</span>
          <input
            type="text"
            value={evidenceReference}
            onChange={(event) => {
              setEvidenceReference(
                event.target.value,
              )
            }}
            minLength={4}
            maxLength={200}
            dir="ltr"
            autoComplete="off"
            required
          />
        </label>

        {actionError && (
          <p className="form-error" role="alert">
            {actionError}
          </p>
        )}

        {actionMessage && (
          <p
            className="form-success"
            role="status"
          >
            {actionMessage}
          </p>
        )}

        <div className="pricing-operation-actions">
          <button
            className="primary-button"
            type="submit"
            disabled={isSubmitting}
          >
            אימות תשלום
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              void handleAction('record_refund')
            }}
            disabled={
              isSubmitting ||
              participantCode.trim().length !==
                16 ||
              evidenceReference.trim().length <
                4
            }
          >
            אימות החזר
          </button>
        </div>
      </form>
    </section>
  )
}

export default PricingPilotAdminPanel
