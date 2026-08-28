import { Link } from 'react-router'
import './MemoryChatLauncher.css'

function MemoryChatLauncher({
  memoryId,
  subjectName,
}) {
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