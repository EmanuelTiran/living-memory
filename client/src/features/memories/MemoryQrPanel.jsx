import { useEffect, useRef, useState } from 'react'
import { changeMemoryQr, getMemoryQr } from '../../api/memoryApi.js'
import { createMemoryAssetAccessLink } from '../../api/assetApi.js'
import './MemoryQr.css'

const publicationLabels = {
  current: 'פורסם · אין שינויים ממתינים',
  pending: 'פורסם · יש שינויים שטרם פורסמו',
  removed: 'פורסם · תוכן שהוסר אינו זמין למבקרים',
  restricted: 'הגישה הציבורית הוגבלה · הדף אינו זמין',
  not_published: 'לא פורסם לציבור',
  disabled: 'קוד ה־QR מושבת · הדף אינו זמין',
}

function ConfirmQrAction({ action, busy, onCancel, onConfirm }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    const trigger = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); trigger?.focus() }
  }, [])
  return <dialog ref={ref} className="surface-card memory-qr-dialog" aria-labelledby="qr-confirm-title" onCancel={(event) => { event.preventDefault(); if (!busy) onCancel() }}>
    <h2 id="qr-confirm-title">{action.title}</h2>
    <p>{action.message}</p>
    <div className="memory-qr-actions">
      <button autoFocus className="secondary-button" disabled={busy} onClick={onCancel}>ביטול</button>
      <button className="primary-button" disabled={busy} onClick={onConfirm}>{busy ? 'שומרים…' : 'אישור'}</button>
    </div>
  </dialog>
}

function PhotoReview({ photo, memoryId, runAuthenticatedRequest }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  return <div>
    <button type="button" className="secondary-button" aria-label={`הצגת התמונה: ${photo.title}`} onClick={async () => {
      try {
        const link = await runAuthenticatedRequest((token) => createMemoryAssetAccessLink(token, memoryId, photo.sourceId, 'inline'))
        setUrl(link.url); setError('')
      } catch { setError('לא הצלחנו להציג את התמונה. נסו שוב.') }
    }}>הצגת התמונה</button>
    {url && <img className="memory-qr-photo-review" src={url} alt={photo.title} />}
    {error && <p role="alert">{error}</p>}
  </div>
}

function QrManagement({ memoryId, runAuthenticatedRequest }) {
  const [data, setData] = useState(null)
  const [selected, setSelected] = useState({ stories: [], photos: [] })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmation, setConfirmation] = useState(null)
  const [consent, setConsent] = useState(false)
  const [retry, setRetry] = useState(0)
  function applyData(next) {
    setData(next)
    setSelected(Object.fromEntries(['stories', 'photos'].map((kind) => [kind, next[kind].filter((item) => item.selected).map((item) => item.sourceId)])))
    setConsent(false)
  }
  useEffect(() => {
    let active = true
    runAuthenticatedRequest((token) => getMemoryQr(token, memoryId)).then((next) => {
      if (active) { applyData(next); setError('') }
    }).catch(() => { if (active) setError('לא הצלחנו לטעון את הגדרות השיתוף.') })
    return () => { active = false }
  }, [memoryId, runAuthenticatedRequest, retry])
  async function execute(body) {
    setBusy(true); setError(''); setNotice('')
    try {
      applyData(await runAuthenticatedRequest((token) => changeMemoryQr(token, memoryId, body)))
      setConfirmation(null)
      setNotice('ההגדרות נשמרו. הקוד הקבוע נשאר ללא שינוי.')
    } catch (error) {
      setConfirmation(null)
      setError(error.code === 'PUBLICATION_CHANGED' ? 'התוכן השתנה מאז שהוצג. רעננו את הרשימה ובדקו שוב לפני הפרסום.' : 'לא הצלחנו לשמור את ההגדרות. נסו שוב.')
    } finally { setBusy(false) }
  }
  function toggle(kind, id) {
    setConsent(false)
    setSelected((current) => ({ ...current, [kind]: current[kind].includes(id) ? current[kind].filter((value) => value !== id) : [...current[kind], id] }))
  }
  function confirm(body, title, message) { setConfirmation({ body, title, message }) }
  const qrImage = data?.svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data.svg)}` : ''
  return <div className="memory-qr-content" aria-busy={busy}>
    <p>קוד ה־QR קבוע. עריכות אינן משנות את מה שכבר פורסם; הגרסה החדשה תופיע רק לאחר אישור ופרסום. אין צורך להדפיס את הקוד מחדש.</p>
    {error && <div role="alert"><p className="form-error">{error}</p><button className="secondary-button" disabled={busy} onClick={() => setRetry((value) => value + 1)}>רענון הרשימה</button></div>}
    {notice && <p role="status" className="form-notice">{notice}</p>}
    {!data ? <p role="status">טוענים את הגדרות השיתוף…</p> : !data.url ? <>
      <p>יצירת הקוד אינה מפרסמת את הארכיון. רק לאחר בחירת התכנים ואישור הפרסום יהיה אפשר לצפות בהם בסריקה.</p>
      <button className="primary-button" disabled={busy} data-aura-tooltip="יוצרים קוד אחד קבוע לזיכרון. הפרסום נעשה בנפרד, באישורכם." onClick={() => execute({ action: 'initialize' })}>יצירת הקוד הקבוע</button>
    </> : <>
      <div className="memory-qr-overview">
        <img className="memory-qr-preview" src={qrImage} alt={`קוד QR קבוע לזיכרון של ${data.profile.subjectName}`} width="240" height="240" />
        <div className="memory-qr-summary">
          <p role="status" tabIndex={0} data-aura-tooltip="עריכות נשארות בארכיון עד לפרסום מחדש. מחיקה מפורשת, ביטול הפרסום או השבתת הקוד מפסיקים את הגישה מיד.">
            <strong>{publicationLabels[data.publicationStatus] ?? (data.published ? publicationLabels.current : publicationLabels.not_published)}</strong>
          </p>
          <div className="form-field"><span id="memory-qr-url-label">הכתובת הקבועה</span><output aria-labelledby="memory-qr-url-label" dir="ltr">{data.url}</output></div>
          <div className="memory-qr-actions">
            <a className="primary-button" href={qrImage} download="living-memory-qr.svg" data-aura-tooltip="קובץ SVG חד להדפסה ולחריטה. יש לשמור על השוליים הלבנים ולבדוק סריקה בגודל הסופי.">הורדת QR להדפסה</a>
            <a className="secondary-button" href={data.url} target="_blank" rel="noopener noreferrer" data-aura-tooltip="פותחים את אותה כתובת שמבקר יראה לאחר סריקה.">פתיחת הדף הציבורי</a>
            <button className="secondary-button" disabled={busy} data-aura-tooltip={data.enabled ? 'עצירת הגישה דרך הקוד, ללא מחיקת הזיכרון. אפשר להפעיל שוב את אותו קוד.' : 'הפעלת אותו קוד מחדש. רק תוכן שאושר לפרסום יהיה נגיש.'} onClick={() => confirm({ action: 'set_enabled', enabled: !data.enabled, confirmed: true }, data.enabled ? 'להשבית את הקוד?' : 'להפעיל מחדש את הקוד?', data.enabled ? 'מבקרים לא יוכלו לצפות בזיכרון דרך הקוד. הארכיון והקוד הקבוע נשמרים.' : 'אותו קוד ישוב לפתוח את התכנים המאושרים לשיתוף ציבורי.')}>{data.enabled ? 'השבתת הקוד' : 'הפעלת הקוד מחדש'}</button>
          </div>
          <p>לפני חריטה או הדפסה, בדקו סריקה בטלפון ובגודל הסופי. אין לחתוך את המסגרת הלבנה.</p>
        </div>
      </div>
      <form onSubmit={(event) => {
        event.preventDefault()
        confirm({ action: 'publish', confirmed: true, profileVersion: data.profileVersion,
          ...Object.fromEntries(['stories', 'photos'].map((kind) => [kind, data[kind].filter((item) => selected[kind].includes(item.sourceId)).map(({ sourceId, version }) => ({ sourceId, version }))])),
        }, 'לפרסם את הזיכרונות שנבחרו?', 'השם, ההקדמה והתכנים שסימנתם יהיו זמינים לכל מי שמחזיק בקישור, וניתן יהיה לשמור או לשתף אותם. הרשאות בני המשפחה אינן משתנות.')
      }}>
        <h3>מה יראו המבקרים?</h3>
        <p>השם וההקדמה יופיעו בדף הציבורי. בחרו עד 12 סיפורים ועד 12 תמונות. הגרסה האחרונה שפורסמה נשארת גלויה לאחר עריכה, עד שתאשרו ותפרסמו גרסה חדשה. תוכן שנמחק או הוסר במפורש יפסיק להיות זמין מיד.</p>
        <div className="memory-qr-profile-review"><strong>{data.profile.subjectName}</strong><p>{data.profile.description || 'ללא הקדמה'}</p></div>
        {data.publicationStatus === 'pending' && <p className="form-notice">יש שינויים שטרם פורסמו. המבקרים עדיין רואים את הגרסה האחרונה שפרסמתם.</p>}
        {data.publicationStatus === 'removed' && <p className="form-notice">תוכן שהוסר במפורש אינו זמין עוד למבקרים. בדקו את הבחירה לפני הפרסום הבא.</p>}
        {data.publicationStatus === 'restricted' && <p className="form-notice">הגדרות פרטיות או בעלות השתנו. הדף הציבורי אינו זמין; בדקו את ההרשאות לפני פרסום מחדש.</p>}
        {['stories', 'photos'].map((kind) => <fieldset key={kind} disabled={busy}>
          <legend>{kind === 'stories' ? 'סיפורים לפרסום' : 'תמונות'} · {selected[kind].length}/12</legend>
          {!data[kind].length && <p>אין כרגע תכנים לבחירה.</p>}
          {data[kind].map((item) => <div className="memory-qr-choice" key={item.sourceId}>
            <label><input type="checkbox" checked={selected[kind].includes(item.sourceId)} disabled={!selected[kind].includes(item.sourceId) && selected[kind].length >= 12} onChange={() => toggle(kind, item.sourceId)} /><span>{item.title}{item.portrait ? ' · תמונת הפרופיל' : ''}{item.retained ? ' · הגרסה שכבר פורסמה; העריכה עדיין ממתינה לאישור בארכיון' : ''}</span></label>
            <details><summary aria-label={`בדיקת התוכן לפני פרסום: ${item.title}`}>בדיקת התוכן לפני פרסום</summary>
              {kind === 'stories' ? <p>{item.content}</p> : <><p>{item.description}</p><PhotoReview photo={item} memoryId={memoryId} runAuthenticatedRequest={runAuthenticatedRequest} /></>}
            </details>
          </div>)}
        </fieldset>)}
        {data.truncated && <p role="status">מוצגים עד 100 סיפורים ו־100 תמונות אחרונים, נוסף על תכנים שכבר נבחרו לפרסום. תכנים אחרים שלא מופיעים כאן לא ייכללו בפרסום הבא.</p>}
        <p>שיחות, הקלטות, תמלולים ופרטי משפחה נשארים באזור המשפחתי. אישור סיפור בארכיון אינו מפרסם אותו אוטומטית.</p>
        <label className="memory-qr-consent"><input type="checkbox" required checked={consent} disabled={busy} onChange={(event) => setConsent(event.target.checked)} /><span>בדקתי את השם, ההקדמה והתכנים שנבחרו, ואני מאשר/ת שיש לי הרשאה לשתף אותם לציבור, לרבות הסכמת אנשים נוספים שמופיעים בהם.</span></label>
        <div className="memory-qr-actions">
          <button className="primary-button" type="submit" disabled={busy || !consent} data-aura-tooltip="אישור מפורש לפרסום השם, ההקדמה ורק התכנים שנבחרו, בגרסה הנוכחית.">אישור ופרסום הבחירה</button>
          {data.published && <button className="secondary-button" type="button" disabled={busy} data-aura-tooltip="החזרת הדף הציבורי למצב לא זמין. הקוד והגישה המשפחתית נשמרים." onClick={() => confirm({ action: 'unpublish', confirmed: true }, 'לבטל את הפרסום הציבורי?', 'התכנים לא יהיו זמינים עוד למבקרים. הקוד הקבוע והארכיון המשפחתי נשמרים.')}>ביטול הפרסום הציבורי</button>}
        </div>
      </form>
    </>}
    {confirmation && <ConfirmQrAction action={confirmation} busy={busy} onCancel={() => setConfirmation(null)} onConfirm={() => execute(confirmation.body)} />}
  </div>
}

export default function MemoryQrPanel(props) {
  const [open, setOpen] = useState(false)
  return <details className="surface-card memory-qr-panel" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary data-aura-tooltip="קוד קבוע להנצחה ולשיתוף. אתם בוחרים בדיוק מה יהיה פתוח לכל מבקר.">קוד QR ושיתוף ציבורי</summary>
    {open && <QrManagement {...props} />}
  </details>
}
