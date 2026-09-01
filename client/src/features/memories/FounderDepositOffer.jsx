import { Link } from 'react-router'

const statusLabels = {
  offered: 'ההצעה הוצגה',
  interested: 'ממתין לאימות תשלום',
  declined: 'לא מצטרפים כרגע',
  paid: 'הפיקדון שולם ואומת',
  refunded: 'הפיקדון הוחזר',
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

function DepositStatus({
  deposit,
  isSubmitting,
  onDecision,
}) {
  const canDecide = [
    'offered',
    'interested',
    'declined',
  ].includes(deposit.status)

  return (
    <div className="pricing-decision-card">
      <div className="pricing-status-line">
        <span>מצב נוכחי</span>
        <strong>
          {statusLabels[deposit.status] ??
            deposit.status}
        </strong>
      </div>

      <div className="participant-code">
        <span>קוד משתתף לתיאום</span>
        <code dir="ltr">
          {deposit.participantCode}
        </code>
      </div>

      {canDecide && (
        <div className="pricing-actions">
          <button
            className="primary-button"
            type="button"
            data-aura-tooltip="לסמן עניין בהצעת קבוצת המייסדים"
            onClick={() => {
              onDecision('interested')
            }}
            disabled={
              isSubmitting ||
              deposit.status === 'interested'
            }
          >
            מעוניין להצטרף
          </button>
          <button
            className="secondary-button"
            type="button"
            data-aura-tooltip="לדחות את ההצעה לעת עתה"
            onClick={() => {
              onDecision('declined')
            }}
            disabled={
              isSubmitting ||
              deposit.status === 'declined'
            }
          >
            לא עכשיו
          </button>
        </div>
      )}

      {deposit.status === 'interested' && (
        <p className="pricing-next-step">
          שמרו את קוד המשתתף. מנהל הפיילוט
          יתאם את אמצעי התשלום ואת תנאי
          ההחזר; לאחר אימות תופיע כאן הודעת
          תשלום.
        </p>
      )}

      {deposit.status === 'paid' && (
        <p className="pricing-paid-note">
          התשלום אומת. פרטי הכרטיס או
          אסמכתת התשלום אינם נשמרים במסך
          זה.
        </p>
      )}

      {deposit.status === 'refunded' && (
        <p className="pricing-refund-note">
          החזרת הפיקדון אומתה ונרשמה במסלול
          הביקורת.
        </p>
      )}
    </div>
  )
}

function FounderDepositOffer({
  memoryId,
  pricingPilot,
  isSubmitting,
  onOffer,
  onDecision,
}) {
  const { program, deposit } = pricingPilot
  const eligible =
    pricingPilot.eligibility?.eligible ===
    true
  const amount = formatMoney(
    program.amountMinor,
    program.currency,
  )

  return (
    <>
      <div className="pricing-offer-card">
        <div>
          <p className="panel-kicker">
            פיקדון חד־פעמי
          </p>
          <strong>{amount}</strong>
          <span>
            בר־החזר · ללא מנוי · ללא חיוב
            חוזר
          </span>
        </div>

        <ul>
          <li>
            השתתפות בקבוצת המייסדים
            המצומצמת.
          </li>
          <li>
            בדיקת הערך של הארכיון המשפחתי
            לפני Public Beta.
          </li>
          <li>
            הפיקדון אינו מקנה לספקי AI
            הרשאות חדשות.
          </li>
        </ul>
      </div>

      {!eligible && !deposit ? (
        <div className="pricing-gate-card">
          <h2>השלימו קודם את שלב 15</h2>
          <p>
            הצעת התמחור מיועדת למשפחה
            שהצטרפה לפיילוט ההתנהגותי, כדי
            למדוד תשלום רק אחרי שימוש אמיתי
            במוצר.
          </p>
          <Link
            className="primary-button"
            data-aura-tooltip="לעבור למסלול הפיילוט המשפחתי"
            to={`/app/memories/${memoryId}/pilot`}
          >
            מעבר לפיילוט המשפחתי
          </Link>
        </div>
      ) : !deposit ? (
        <div className="pricing-decision-card">
          <h2>רוצים לראות את ההצעה?</h2>
          <p>
            פתיחת ההצעה תיצור קוד משתתף
            אנונימי. עדיין לא יתבצע שום
            חיוב.
          </p>
          <button
            className="primary-button"
            type="button"
            data-aura-tooltip="לפתוח הצעה בלי לבצע חיוב"
            onClick={onOffer}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'פותחים...'
              : 'פתיחת הצעת המייסדים'}
          </button>
        </div>
      ) : (
        <DepositStatus
          deposit={deposit}
          isSubmitting={isSubmitting}
          onDecision={onDecision}
        />
      )}
    </>
  )
}

export default FounderDepositOffer
