import { Link } from 'react-router'
import './MemoryChatLauncher.css'

function MemoryChatLauncher({
  memoryId,
  subjectName,
}) {
  return (
    <article className="memory-chat-launcher">
      <span aria-hidden="true">03</span>

      <h2>שיחה אינטראקטיבית</h2>

      <p>
        שוחחו בטקסט עם הדמיית הזיכרון.
        התשובות יתבססו רק על סיפורים
        שנבדקו ואושרו.
      </p>

      <Link
        className="memory-chat-start-button"
        to={`/app/memories/${encodeURIComponent(memoryId)}/chat`}
        state={{
          subjectName,
        }}
      >
        התחלת שיחה
      </Link>
    </article>
  )
}

export default MemoryChatLauncher