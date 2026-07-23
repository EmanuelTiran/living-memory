import './App.css'

const principles = [
  {
    title: 'מבוסס מקורות',
    description: 'הדמות תשתמש רק בחומרים שנמסרו, נבדקו ואושרו.',
  },
  {
    title: 'פרטי ומאובטח',
    description: 'כל זיכרון יהיה פרטי כברירת מחדל ומופרד מזיכרונות אחרים.',
  },
  {
    title: 'אנושי ומכבד',
    description: 'המערכת תשמור על גבולות ברורים ולא תציג את הדמות כאדם עצמו.',
  },
]

function App() {
  return (
    <main className="app-shell">
      <section className="welcome-card" aria-labelledby="welcome-title">
        <div className="brand-line" aria-hidden="true" />

        <p className="eyebrow">זיכרון חי</p>

        <h1 id="welcome-title">
          שומרים סיפורי חיים
          <span> בכבוד, באחריות ובאמינות</span>
        </h1>

        <p className="lead">
          מקום משפחתי לשימור זיכרונות, סיפורים ומורשת — וליצירת שיחה
          אינטראקטיבית המבוססת על מקורות מאושרים.
        </p>

        <aside className="ai-disclosure" aria-label="הבהרה חשובה">
          <span className="disclosure-mark" aria-hidden="true">
            AI
          </span>

          <p>
            זו תהיה דמות AI המבוססת על חומרים שנמסרו ואושרו. היא אינה האדם
            עצמו, ותשובותיה עשויות לכלול הסקות או טעויות.
          </p>
        </aside>

        <ul className="principles" aria-label="עקרונות המערכת">
          {principles.map((principle) => (
            <li key={principle.title}>
              <h2>{principle.title}</h2>
              <p>{principle.description}</p>
            </li>
          ))}
        </ul>

        <p className="development-status">
          <span aria-hidden="true" />
          תשתית הלקוח פועלת בהצלחה
        </p>
      </section>
    </main>
  )
}

export default App