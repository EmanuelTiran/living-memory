import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import BrandLogo from '../../BrandLogo.jsx'
import './MemoryProfilePage.css'
import './MemoryQr.css'

export function PublicMemoryContent({ memory }) {
  const portrait = memory.photos.find((photo) => photo.portrait)
  const photos = memory.photos.filter((photo) => !photo.portrait)
  return <>
    <section className={`memory-profile-hero public-memory-hero ${portrait ? '' : 'public-memory-hero-text'}`} aria-labelledby="public-memory-name">
      <div className="memory-profile-hero-copy">
        <p className="memory-profile-hero-kicker">חיים שלמים של זיכרונות</p>
        <h1 className="memory-profile-title" id="public-memory-name">{memory.subjectName}</h1>
        {memory.description && <div className="public-memory-introduction">{memory.description.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>}
        {memory.stories.length > 0 && <a className="primary-button" href="#public-stories">אל הסיפורים</a>}
      </div>
      {portrait && <img className="public-memory-portrait" src={portrait.url} alt={portrait.title} fetchPriority="high" />}
    </section>
    {memory.stories.length > 0 && <section id="public-stories" className="public-memory-section" aria-labelledby="public-stories-title">
      <p className="panel-kicker">הסיפורים שנשארים איתנו</p>
      <h2 id="public-stories-title">רגעים מתוך החיים</h2>
      <div className="public-memory-stories">{memory.stories.map((story, index) => <article className="surface-card public-memory-story" key={index}>
        {story.occurredOn && <time dateTime={story.occurredOn}>{new Intl.DateTimeFormat('he-IL', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${story.occurredOn}T00:00:00Z`))}</time>}
        <h3>{story.title}</h3>
        {story.content.length <= 650 ? <p>{story.content}</p> : <>
          <p className="public-memory-story-preview">{story.content.slice(0, 500)}…</p>
          <details><summary aria-label={`לקריאת הסיפור המלא: ${story.title}`}>לקריאת הסיפור המלא</summary><p>{story.content}</p></details>
        </>}
      </article>)}</div>
    </section>}
    {photos.length > 0 && <section className="public-memory-section" aria-labelledby="public-photos-title">
      <p className="panel-kicker">מבט אל הזיכרונות</p>
      <h2 id="public-photos-title">תמונות מהחיים</h2>
      <div className="public-memory-photos">{photos.map((photo) => <figure className="surface-card" key={photo.url}>
        <img src={photo.url} alt={photo.title} loading="lazy" decoding="async" />
        <figcaption>{photo.title}{photo.description && <p>{photo.description}</p>}</figcaption>
      </figure>)}</div>
    </section>}
  </>
}

export default function PublicMemoryPage() {
  const { token } = useParams()
  const [state, setState] = useState({ token: '', status: 'loading' })
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let inFlight = false
    async function load() {
      if (inFlight) return
      inFlight = true
      try {
        const response = await fetch(`/api/public/memories/${encodeURIComponent(token)}`, {
          credentials: 'omit', cache: 'no-store', signal: controller.signal,
        })
        const payload = await response.json()
        if (!response.ok) {
          setState({ token, status: [400, 404].includes(response.status) ? 'unavailable' : 'error' })
        } else {
          setState({ token, status: 'ready', memory: payload.data })
        }
      } catch (error) {
        if (error.name !== 'AbortError') setState({ token, status: 'error' })
      } finally { inFlight = false }
    }
    function refreshVisible() { if (document.visibilityState === 'visible') load() }
    load()
    const interval = window.setInterval(refreshVisible, 60_000)
    document.addEventListener('visibilitychange', refreshVisible)
    window.addEventListener('pageshow', refreshVisible)
    return () => {
      controller.abort()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshVisible)
      window.removeEventListener('pageshow', refreshVisible)
    }
  }, [token, retry])
  const status = state.token === token ? state.status : 'loading'
  return <main className="page-shell public-memory-shell" dir="rtl" lang="he">
    <title>{status === 'ready' ? `${state.memory.subjectName} | זיכרון חי` : 'זיכרון חי'}</title>
    <meta name="robots" content="noindex, nofollow, noarchive" />
    <meta name="referrer" content="no-referrer" />
    <div className="public-memory-page">
      <Link to="/" className="public-memory-brand" aria-label="זיכרון חי — עמוד הבית"><BrandLogo compact /></Link>
      {status === 'ready' ? <PublicMemoryContent memory={state.memory} /> : <section className="surface-card public-memory-state" aria-live="polite">
        {status === 'loading' ? <><span className="loading-indicator" aria-hidden="true" /><p>פותחים את הזיכרון…</p></> : <>
          <h1>{status === 'unavailable' ? 'הזיכרון אינו זמין לצפייה ציבורית' : 'לא הצלחנו לפתוח את הזיכרון'}</h1>
          <p>{status === 'unavailable' ? 'המשפחה בוחרת מתי ואילו זיכרונות לשתף. אפשר לחזור לכאן בהמשך.' : 'בדקו את החיבור ונסו שוב בעוד רגע.'}</p>
          {status === 'error' && <button className="secondary-button" onClick={() => setRetry((value) => value + 1)}>ניסיון נוסף</button>}
        </>}
      </section>}
      <footer className="public-memory-footer"><p>הזיכרונות שנבחרו לשיתוף, באהבה ולדורות הבאים.</p><Link to="/privacy">פרטיות</Link></footer>
    </div>
  </main>
}
