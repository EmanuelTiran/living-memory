import { Link } from 'react-router'
import {
  getMemoryChatLauncherState,
} from './memoryChatLauncherState.js'
import './MemoryChatLauncher.css'

function MemoryChatLauncher({
  canContribute = false,
  canManage = false,
  hasApprovedSources = true,
  isCheckingSources = false,
  memoryId,
  onRetrySourceCheck,
  sourceCheckFailed = false,
  subjectName,
}) {
  const launcherState =
    getMemoryChatLauncherState({
      hasApprovedSources,
      isCheckingSources,
      sourceCheckFailed,
    })

  if (launcherState === 'checking') {
    return (
      <article className="memory-chat-launcher memory-chat-launcher-waiting">
        <span>שיחה מבוססת־מקור</span>
        <h2>בודקים אילו מקורות כבר אושרו</h2>
        <p>
          מיד נבדוק אם אפשר להתחיל שיחה שמבוססת רק על התוכן המשפחתי שנשמר.
        </p>
      </article>
    )
  }

  if (launcherState === 'error') {
    return (
      <article className="memory-chat-launcher memory-chat-launcher-error">
        <span>שיחה מבוססת־מקור</span>
        <h2>לא הצלחנו לבדוק את המקורות המאושרים</h2>
        <p>
          השיחה נשארת סגורה עד שנוכל לוודא שקיים לפחות מקור מאושר.
        </p>

        {onRetrySourceCheck && (
          <button
            className="memory-chat-retry-button"
            type="button"
            data-aura-tooltip="לבדוק שוב אם קיים מקור מאושר"
            onClick={onRetrySourceCheck}
          >
            ניסיון בדיקה נוסף
          </button>
        )}
      </article>
    )
  }

  if (launcherState === 'empty') {
    return (
      <article className="memory-chat-launcher memory-chat-launcher-empty">
        <span>שיחה מבוססת־מקור</span>

        <h2>השיחה תיפתח אחרי אישור המקור הראשון</h2>

        <p>
          כדי לקבל תשובה אמינה על {subjectName}, שומרים ומאשרים תחילה סיפור,
          תשובה או תמלול אחד. עד אז אפשר להמשיך לתעד או להשאיר שאלה למשפחה.
        </p>

        {canContribute && (
          <Link
            className="memory-chat-start-button"
            data-aura-tooltip={
              canManage
                ? 'להתחיל בשאלה הראשונה בראיון'
                : 'לכתוב את הסיפור הראשון בארכיון'
            }
            to={`/app/memories/${encodeURIComponent(memoryId)}?tab=documentation${
              canManage
                ? '#guided-interview'
                : '#stories-title'
            }`}
            state={
              canManage
                ? {
                    startGuidedInterview:
                      true,
                  }
                : undefined
            }
          >
            {canManage
              ? 'התחלת שיחה ראשונה'
              : 'כתיבת סיפור ראשון'}
          </Link>
        )}
      </article>
    )
  }

  return (
    <article className="memory-chat-launcher">
      <span>Ask their story · with proof</span>

      <h2>שאלו את הסיפור — וקבלו את המקור</h2>

      <p>
        שאלו שאלה על {subjectName}. כל תשובה
        תסומן כמאומתת, כהסקה זהירה או כמידע
        שעדיין אינו קיים, ותאפשר לפתוח את הסיפור
        או ההקלטה שעליהם היא מבוססת.
      </p>

      <ul className="memory-chat-trust-list" aria-label="כללי אמון בתשובות">
        <li>תשובה מסומנת</li>
        <li>מקור מאושר</li>
        <li>הקלטה מקורית כשזמינה</li>
      </ul>

      <Link
        className="memory-chat-start-button"
        data-aura-tooltip="לפתוח שיחה המבוססת על מקורות מאושרים"
        to={`/app/memories/${encodeURIComponent(memoryId)}/chat`}
        state={{
          subjectName,
        }}
      >
        שאלת שאלה ראשונה
      </Link>
    </article>
  )
}

export default MemoryChatLauncher
