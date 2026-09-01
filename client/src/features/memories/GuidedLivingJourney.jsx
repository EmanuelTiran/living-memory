import { Link } from 'react-router'
import './GuidedLivingJourney.css'

function GuidedLivingJourney({
  memoryId,
  subjectName,
  authorizationRole = 'owner',
  canUseGuidedInterview = true,
}) {
  const canContribute =
    authorizationRole !== 'viewer'

  const canManageFamily = [
    'owner',
    'steward',
  ].includes(authorizationRole)
  const profilePath =
    `/app/memories/${encodeURIComponent(memoryId)}`

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
          <Link
            className="secondary-button guided-living-primary-action"
            data-aura-tooltip={
              canUseGuidedInterview
                ? 'להמשיך לשאלה הבאה בראיון'
                : 'לכתוב סיפור חדש לארכיון'
            }
            to={
              canUseGuidedInterview
                ? `${profilePath}?tab=documentation#guided-interview`
                : `${profilePath}?tab=documentation#stories-title`
            }
          >
            {canUseGuidedInterview
              ? 'שיחה קצרה השבוע'
              : 'כתיבת סיפור קצר'}
          </Link>
        ) : (
          <Link
            className="secondary-button guided-living-primary-action"
            data-aura-tooltip="לשאול שאלה על בסיס המקורות"
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
            <strong>
              {canUseGuidedInterview
                ? 'מדברים כמה דקות'
                : 'שומרים זיכרון אחד'}
            </strong>
            <p>
              {canUseGuidedInterview
                ? 'שאלה אנושית אחת בקול, בלי שאלון ובלי צורך להתכונן.'
                : 'כותבים רגע, סיפור או פרט משפחתי קצר ומוסיפים אותו לארכיון.'}
            </p>
            {canContribute ? (
              <Link
                data-aura-tooltip={
                  canUseGuidedInterview
                    ? 'להתחיל בשאלה הראשונה בראיון'
                    : 'לכתוב סיפור חדש לארכיון'
                }
                to={
                  canUseGuidedInterview
                    ? `${profilePath}?tab=documentation#guided-interview`
                    : `${profilePath}?tab=documentation#stories-title`
                }
              >
                {canUseGuidedInterview
                  ? 'פתיחת הראיון'
                  : 'הוספת סיפור'}
              </Link>
            ) : (
              <Link
                data-aura-tooltip="לפתוח את הסיפורים שנשמרו"
                to={`${profilePath}?tab=archive`}
              >
                צפייה בסיפורים
              </Link>
            )}
          </div>
        </li>

        <li className="guided-living-step">
          <span className="guided-living-step-number">2</span>
          <div>
            <strong>שומרים סיפור ומקור</strong>
            <p>בודקים את התמלול ושומרים גם את ההקלטה המקורית.</p>
            <Link
              data-aura-tooltip="לראות סיפורים לפי נושאים וקשרים"
              to={`${profilePath}?tab=archive#guided-story-map`}
            >
              צפייה במפת הסיפורים
            </Link>
          </div>
        </li>

        <li className="guided-living-step">
          <span className="guided-living-step-number">3</span>
          <div>
            <strong>שואלים את הסיפור</strong>
            <p>כל תשובה מסומנת ומציגה על אילו זיכרונות היא מבוססת.</p>
            <Link
              data-aura-tooltip="לפתוח שיחה המבוססת על מקורות"
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
                data-aura-tooltip="להזמין בן משפחה לזיכרון"
                to={`/app/memories/${encodeURIComponent(memoryId)}/family`}
              >
                הזמנת בן או בת משפחה
              </Link>
            ) : (
              <Link
                data-aura-tooltip="לעבור לשאלות שמחכות למשפחה"
                to={`${profilePath}?tab=family#family-questions`}
              >
                מעבר לשאלות המשפחה
              </Link>
            )}
          </div>
        </li>
      </ol>
    </section>
  )
}

export default GuidedLivingJourney
