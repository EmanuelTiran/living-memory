import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/authApi.js'
import { archiveMemoryExternalVideo, listMemoryExternalVideos, saveMemoryExternalVideo } from '../../api/assetApi.js'
import { normalizeYouTubeVideo } from '../../../../shared/youtubeVideo.js'
import './MemoryExternalVideos.css'

const emptyForm = { displayName: '', description: '', url: '' }

function errorMessage(error) {
  if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') return 'בדקו את הכותרת ואת הקישור. אפשר להוסיף קישור HTTPS של YouTube או youtu.be בלבד.'
  if (error instanceof ApiError && error.code === 'MEMORY_NOT_FOUND') return 'הזיכרון לא נמצא או שאין לכם הרשאה לפעולה הזאת.'
  return 'לא הצלחנו להשלים את הפעולה. נסו שוב.'
}

function MemoryExternalVideos({ memoryId, canContribute, canEdit, runAuthenticatedRequest, onCountChange }) {
  const [videos, setVideos] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loadVersion, setLoadVersion] = useState(0)
  const titleInput = useRef(null)
  useEffect(() => {
    if (editingId) titleInput.current?.focus()
  }, [editingId])
  useEffect(() => {
    let current = true
    runAuthenticatedRequest(token => listMemoryExternalVideos(token, memoryId))
      .then(items => { if (current) { setVideos(items); setError('') } })
      .catch(err => { if (current) setError(errorMessage(err)) })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [memoryId, runAuthenticatedRequest, loadVersion])

  function change(event) { setForm(value => ({ ...value, [event.target.name]: event.target.value })) }

  async function submit(event) {
    event.preventDefault()
    setError(''); setSuccess('')
    if (!editingId && !normalizeYouTubeVideo(form.url)) {
      setError('יש להזין קישור HTTPS תקין של YouTube או youtu.be.'); return
    }
    setBusy(true)
    try {
      const input = { displayName: form.displayName.trim(), description: form.description.trim(), ...(!editingId ? { url: form.url.trim() } : {}) }
      const video = await runAuthenticatedRequest(token => saveMemoryExternalVideo(token, memoryId, input, editingId))
      const next = editingId ? videos.map(item => item.id === video.id ? video : item) : [video, ...videos]
      setVideos(next); onCountChange?.(next.length)
      setEditingId(''); setForm(emptyForm)
      setSuccess('הסרטון נשמר בארכיון. לצפייה בחרו ״צפייה ב־YouTube״.')
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }

  async function archive(video) {
    if (!window.confirm(`להעביר את ״${video.displayName}״ לארכיון? הסרטון ב־YouTube לא יימחק.`)) return
    setBusy(true); setError(''); setSuccess('')
    try {
      await runAuthenticatedRequest(token => archiveMemoryExternalVideo(token, memoryId, video.id))
      const next = videos.filter(item => item.id !== video.id)
      setVideos(next); onCountChange?.(next.length)
      if (editingId === video.id) { setEditingId(''); setForm(emptyForm) }
      setSuccess('הקישור הועבר לארכיון. הסרטון המקורי לא השתנה.')
    } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }

  return (
    <section className="memory-external-videos" aria-labelledby="memory-external-videos-title" dir="rtl">
      <h3 id="memory-external-videos-title">סרטוני המשפחה וקישורי YouTube</h3>
      <p>מוסיפים קישור לסרטון קיים ב־YouTube. כרגע אפשר להעלות קובצי תמונה ו־PDF; להוספת וידאו משתמשים בקישור.</p>
      <p>הסרטון נשאר ב־YouTube. הצפייה נפתחת באתר חיצוני וכפופה להרשאות ולזמינות שלו.</p>
      {error && <div role="alert"><p className="form-error">{error}</p><button type="button" className="secondary-button" disabled={busy} onClick={() => setLoadVersion(v => v + 1)}>טעינה מחדש</button></div>}
      {success && <p role="status" className="story-success">{success}</p>}
      {canContribute && (
        <form className="memory-asset-upload-form" onSubmit={submit} aria-label={editingId ? 'עריכת פרטי הסרטון' : 'הוספת סרטון מקישור'} aria-busy={busy}>
          <h4>{editingId ? 'עריכת פרטי הסרטון' : 'הוספת וידאו או קישור YouTube'}</h4>
          {!editingId && <label className="memory-asset-field"><span>קישור לסרטון YouTube</span><input id="memory-external-video-url" name="url" type="url" dir="ltr" value={form.url} onChange={change} maxLength={2048} placeholder="https://www.youtube.com/watch?v=…" required disabled={busy} /></label>}
          <label className="memory-asset-field"><span>כותרת הסרטון</span><input ref={titleInput} name="displayName" value={form.displayName} onChange={change} minLength={2} maxLength={120} required disabled={busy} /></label>
          <label className="memory-asset-field"><span>תיאור הסרטון — לא חובה</span><textarea name="description" value={form.description} onChange={change} maxLength={500} rows={3} disabled={busy} /></label>
          <div className="memory-external-video-actions"><button className="primary-button" disabled={busy || loading}>{busy ? 'שומרים…' : editingId ? 'שמירת פרטי הסרטון' : 'שמירת הסרטון בארכיון'}</button>
            {editingId && <button type="button" className="secondary-button" disabled={busy} onClick={() => { setEditingId(''); setForm(emptyForm) }}>ביטול עריכה</button>}
          </div>
        </form>
      )}
      {loading ? <p role="status">טוענים סרטונים…</p> : videos.length === 0 ? <p>עדיין אין סרטונים. קישור שתוסיפו יופיע כאן.</p> : (
        <div className="memory-assets-grid">
          {videos.map(video => {
            const reference = normalizeYouTubeVideo(video.canonicalUrl)
            return <article className="memory-asset-card" key={video.id} aria-label={video.displayName}>
              <div className="memory-asset-visual"><span aria-hidden="true">▶ YouTube</span></div>
              <div className="memory-asset-card-body">
                <h4>{video.displayName}</h4>
                {video.description && <p>{video.description}</p>}
                <p>מקור: YouTube{reference?.startSeconds > 0 ? ` · מתחיל בשנייה ${reference.startSeconds}` : ''}</p>
                <div className="memory-external-video-actions">
                  {reference ? <a className="primary-button" href={reference.canonicalUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">צפייה ב־YouTube</a> : <p>הקישור אינו זמין.</p>}
                  {canEdit && <><button className="secondary-button" disabled={busy} type="button" onClick={() => { setEditingId(video.id); setForm({ displayName: video.displayName, description: video.description ?? '', url: '' }); setError(''); setSuccess('') }}>עריכת פרטי הסרטון</button><button className="secondary-button" disabled={busy} type="button" onClick={() => archive(video)}>העברה לארכיון</button></>}
                </div>
              </div>
            </article>
          })}
        </div>
      )}
    </section>
  )
}

export default MemoryExternalVideos
