import { Link } from 'react-router'
import './GuidedLivingJourney.css'

function GuidedLivingJourney({
  memoryId,
  subjectName,
  authorizationRole = 'owner',
}) {
  const canContribute =
    authorizationRole !== 'viewer'

  const canManageFamily = [
    'owner',
    'steward',
  ].includes(authorizationRole)

  return (
    <section
      className="guided-living-journey"
      aria-labelledby="guided-living-journey-title"
    >
      <div className="guided-living-journey-heading">
        <div>
          <p className="panel-kicker">
            המסלול המשפחתי
          </p>

          <h2 id="guided-living-journey-title">
            מדברים, שומרים ושואלים — תמיד עם מקור
          </h2>

          <p>
            לא צריך למלא את סיפור החיים בבת אחת. בכל ביקור עושים
            פעולה משמעותית אחת, והארכיון של {subjectName} הולך ומעמיק.
          </p>
        </div>

        {canContribute ? (
          <a
            className="secondary-button guided-living-primary-action"
            href="#guided-interview"
          >
            שיחה קצרה השבוע
          </a>
        ) : (
          <Link
            className="secondary-button guided-living-primary-action"
            to={`/app/memories/${encodeURIComponent(memoryId)}/chat`}
            state={{ subjectName }}
          >
            שאלת שאלה לארכיון
          </Link>
        )}
      </div>

      <ol className="guided-living-steps">
        <li
          className="guided-living-step guided-living-step-primary"
          aria-current="step"
        >
          <span className="guided-living-step-number">1</span>
          <div>
            <strong>מדברים כמה דקות</strong>
            <p>שאלה אנושית אחת בקול, בלי שאלון ובלי צורך להתכונן.</p>
            <a href="#guided-interview">פתיחת הראיון</a>
          </div>
        </li>

        <li className="guided-living-step">
          <span className="guided-living-step-number">2</span>
          <div>
            <strong>שומרים סיפור ומקור</strong>
            <p>בודקים את התמלול ושומרים גם את ההקלטה המקורית.</p>
            <a href="#guided-story-map">צפייה במפת הסיפורים</a>
          </div>
        </li>

        <li className="guided-living-step">
          <span className="guided-living-step-number">3</span>
          <div>
            <strong>שואלים את הסיפור</strong>
            <p>כל תשובה מסומנת ומציגה על אילו זיכרונות היא מבוססת.</p>
            <Link
              to={`/app/memories/${encodeURIComponent(memoryId)}/chat`}
              state={{ subjectName }}
            >
              מעבר לשאלה עם מקור
            </Link>
          </div>
        </li>

        <li className="guided-living-step">
          <span className="guided-living-step-number">4</span>
          <div>
            <strong>המשפחה ממשיכה</strong>
            <p>מזמינים אדם קרוב, משאירים שאלה ומחזירים את השיחה לחיים.</p>
            {canManageFamily ? (
              <Link
                to={`/app/memories/${encodeURIComponent(memoryId)}/family`}
              >
                הזמנת בן או בת משפחה
              </Link>
            ) : (
              <a href="#family-questions">מעבר לשאלות המשפחה</a>
            )}
          </div>
        </li>
      </ol>
    </section>
  )
}

export default GuidedLivingJourney
