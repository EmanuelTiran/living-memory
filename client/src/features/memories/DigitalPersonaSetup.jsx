import {
  useEffect,
  useState,
} from 'react'
import { ApiError } from '../../api/authApi.js'
import {
  acceptDigitalPersonaSelfConsent,
  activateDigitalPersonaChatVoiceInput,
  activateDigitalPersonaDIDAvatar,
  activateDigitalPersonaVoiceClone,
  getDigitalPersonaSetup,
  initializeDigitalPersonaMockProfiles,
  revokeDigitalPersonaSelfConsent,
} from '../../api/memoryApi.js'
import './DigitalPersonaSetup.css'

const initialConsentForm = {
  subjectNameConfirmation: '',
  confirmsOwnIdentity: false,
  permitsVoiceUse: false,
  permitsLikenessUse: false,
  understandsAiRepresentation: false,
  acceptsSafetyRestrictions: false,
}

const initialVoiceCloneForm = {
  confirmsOwnVoice: false,
  confirmsExistingVoiceClone: false,
  permitsElevenLabsTextTransfer:
    false,
  understandsElevenLabsRetention:
    false,
}

const initialDIDAvatarForm = {
  confirmsOwnLikeness: false,
  confirmsAuthorizedAvatarImage: false,
  permitsDIDImageTransfer: false,
  permitsDIDAudioTransfer: false,
  understandsDIDRetention: false,
}

const initialChatVoiceInputForm = {
  confirmsOwnVoice: false,
  permitsOpenAIAudioTransfer: false,
  understandsOpenAIProcessing: false,
  understandsAudioNotStored: false,
  understandsManualReview: false,
}

function getErrorMessage(error) {
  if (!(error instanceof ApiError)) {
    return 'אירעה שגיאה בלתי צפויה.'
  }

  const messages = {
    MEMORY_NOT_FOUND:
      'הזיכרון לא נמצא או שאין לכם הרשאה לנהל את הקול והאווטאר שלו.',
    SELF_CONSENT_SUBJECT_MISMATCH:
      'השם שהקלדתם אינו זהה לשם האדם בפרופיל הזיכרון.',
    DIGITAL_PERSONA_CONSENT_REQUIRED:
      'יש לאשר תחילה את טופס ההסכמה העצמית.',
    VOICE_CLONE_NOT_CONFIGURED:
      'יש להגדיר ELEVENLABS_API_KEY ו־ELEVENLABS_VOICE_ID בשרת לפני הפעלת הקול האישי.',
    CHAT_VOICE_INPUT_NOT_CONFIGURED:
      'יש להגדיר OPENAI_API_KEY ומודל תמלול בשרת לפני הפעלת הקלט הקולי לצ׳אט.',
    DID_NOT_CONFIGURED:
      'יש להגדיר DID_API_KEY בשרת ולהפעיל אותו מחדש.',
    DID_VOICE_CLONE_REQUIRED:
      'יש להפעיל תחילה את הקול האישי של ElevenLabs.',
    DID_PORTRAIT_REQUIRED:
      'יש להוסיף תחילה תמונה של האדם בפרטי הזיכרון.',
    DID_AUTHENTICATION_FAILED:
      'מפתח D‑ID נדחה. יש לבדוק את DID_API_KEY בשרת.',
    DID_BILLING_REQUIRED:
      'חשבון D‑ID אינו מאפשר כרגע הפקת וידאו. יש לבדוק את היתרה והמסלול.',
    VALIDATION_ERROR:
      'יש למלא את השם ולאשר את כל סעיפי ההסכמה.',
    AUTHENTICATION_REQUIRED:
      'החיבור לחשבון הסתיים. יש להתחבר מחדש.',
    NETWORK_ERROR:
      'לא הצלחנו להתחבר לשרת.',
  }

  return (
    messages[error.code] ??
    'לא הצלחנו להשלים את הפעולה.'
  )
}

function formatDate(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      dateStyle: 'long',
      timeStyle: 'short',
    },
  ).format(date)
}

function ProfileStatusCard({
  title,
  profile,
  readyText,
  waitingText,
  readyLabel = 'מוכן לבדיקה',
}) {
  const isReady =
    profile?.status === 'ready'

  return (
    <article
      className={
        isReady
          ? 'persona-profile-card persona-profile-ready'
          : 'persona-profile-card'
      }
    >
      <div>
        <h3>{title}</h3>

        <span
          className={
            isReady
              ? 'persona-status persona-status-ready'
              : 'persona-status'
          }
        >
          {isReady
            ? readyLabel
            : 'טרם נוצר'}
        </span>
      </div>

      <p>
        {isReady ? readyText : waitingText}
      </p>

      {profile?.disclosure && (
        <small>{profile.disclosure}</small>
      )}
    </article>
  )
}

function DigitalPersonaSetup({
  memoryId,
  subjectName,
  portraitUrl = '',
  hasPortrait = false,
  onRequestPortrait,
  runAuthenticatedRequest,
}) {
  const [setup, setSetup] = useState(null)
  const [consentForm, setConsentForm] =
    useState({
      ...initialConsentForm,
      subjectNameConfirmation:
        subjectName,
    })
  const [
    voiceCloneForm,
    setVoiceCloneForm,
  ] = useState(
    initialVoiceCloneForm,
  )
  const [didAvatarForm, setDIDAvatarForm] =
    useState(initialDIDAvatarForm)
  const [
    chatVoiceInputForm,
    setChatVoiceInputForm,
  ] = useState(
    initialChatVoiceInputForm,
  )
  const [isLoading, setIsLoading] =
    useState(true)
  const [activeAction, setActiveAction] =
    useState('')
  const [errorMessage, setErrorMessage] =
    useState('')
  const [successMessage, setSuccessMessage] =
    useState('')

  useEffect(() => {
    let isActive = true

    async function loadSetup() {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const loadedSetup =
          await runAuthenticatedRequest(
            (accessToken) =>
              getDigitalPersonaSetup(
                accessToken,
                memoryId,
              ),
          )

        if (isActive) {
          setSetup(loadedSetup)
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(
            getErrorMessage(error),
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadSetup()

    return () => {
      isActive = false
    }
  }, [memoryId, runAuthenticatedRequest])

  function handleConsentChange(event) {
    const { name, type, value, checked } =
      event.target

    setConsentForm((current) => ({
      ...current,
      [name]:
        type === 'checkbox'
          ? checked
          : value,
    }))
  }

  async function handleConsentSubmit(event) {
    event.preventDefault()
    setActiveAction('consent')
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const updatedSetup =
        await runAuthenticatedRequest(
          (accessToken) =>
            acceptDigitalPersonaSelfConsent(
              accessToken,
              memoryId,
              consentForm,
            ),
        )

      setSetup(updatedSetup)
      setSuccessMessage(
        'ההסכמה העצמית נשמרה. כעת אפשר להפעיל את פרופילי הבדיקה.',
      )
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      )
    } finally {
      setActiveAction('')
    }
  }

  async function handleInitializeProfiles() {
    setActiveAction('profiles')
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const updatedSetup =
        await runAuthenticatedRequest(
          (accessToken) =>
            initializeDigitalPersonaMockProfiles(
              accessToken,
              memoryId,
            ),
        )

      setSetup(updatedSetup)
      setSuccessMessage(
        'פרופילי הקול והאווטאר לדוגמה מוכנים.',
      )
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      )
    } finally {
      setActiveAction('')
    }
  }

  function handleVoiceCloneChange(
    event,
  ) {
    const {
      checked,
      name,
      type,
      value,
    } = event.target

    setVoiceCloneForm((current) => ({
      ...current,
      [name]:
        type === 'checkbox'
          ? checked
          : value,
    }))
  }

  async function handleVoiceCloneSubmit(
    event,
  ) {
    event.preventDefault()
    setActiveAction('voice-clone')
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const updatedSetup =
        await runAuthenticatedRequest(
          (accessToken) =>
            activateDigitalPersonaVoiceClone(
              accessToken,
              memoryId,
              voiceCloneForm,
            ),
        )

      setSetup(updatedSetup)
      setSuccessMessage(
        'הקול האישי הופעל. תשובות בעברית יישלחו ישירות ל־ElevenLabs ויושמעו בקול ה־AI שלכם.',
      )
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      )
    } finally {
      setActiveAction('')
    }
  }

  function handleChatVoiceInputChange(
    event,
  ) {
    const { checked, name } = event.target

    setChatVoiceInputForm((current) => ({
      ...current,
      [name]: checked,
    }))
  }

  async function handleChatVoiceInputSubmit(
    event,
  ) {
    event.preventDefault()
    setActiveAction('chat-voice-input')
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const updatedSetup =
        await runAuthenticatedRequest(
          (accessToken) =>
            activateDigitalPersonaChatVoiceInput(
              accessToken,
              memoryId,
              chatVoiceInputForm,
            ),
        )

      setSetup(updatedSetup)
      setSuccessMessage(
        'הקלט הקולי לצ׳אט הופעל. ההקלטה תישלח ל־OpenAI רק בלחיצה על המיקרופון, והתמלול תמיד ימתין לבדיקה לפני שליחה.',
      )
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      )
    } finally {
      setActiveAction('')
    }
  }

  function handleDIDAvatarChange(event) {
    const { checked, name } = event.target

    setDIDAvatarForm((current) => ({
      ...current,
      [name]: checked,
    }))
  }

  async function handleDIDAvatarSubmit(event) {
    event.preventDefault()
    setActiveAction('did-avatar')
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const updatedSetup =
        await runAuthenticatedRequest(
          (accessToken) =>
            activateDigitalPersonaDIDAvatar(
              accessToken,
              memoryId,
              didAvatarForm,
            ),
        )

      setSetup(updatedSetup)
      setSuccessMessage(
        'אווטאר D‑ID הופעל. התמונה המקומית תוצג מייד, ווידאו ייווצר רק לאחר לחיצה מפורשת בשיחה.',
      )
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setActiveAction('')
    }
  }

  async function handleRevokeConsent() {
    const shouldRevoke = window.confirm(
      'האם לבטל את ההסכמה? פרופילי הקול והאווטאר יושבתו מיד.',
    )

    if (!shouldRevoke) {
      return
    }

    setActiveAction('revoke')
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const updatedSetup =
        await runAuthenticatedRequest(
          (accessToken) =>
            revokeDigitalPersonaSelfConsent(
              accessToken,
              memoryId,
            ),
        )

      setSetup(updatedSetup)
      setConsentForm({
        ...initialConsentForm,
        subjectNameConfirmation:
          subjectName,
      })
      setVoiceCloneForm(
        initialVoiceCloneForm,
      )
      setDIDAvatarForm(initialDIDAvatarForm)
      setChatVoiceInputForm(
        initialChatVoiceInputForm,
      )
      setSuccessMessage(
        'ההסכמה בוטלה והפרופילים הושבתו.',
      )
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      )
    } finally {
      setActiveAction('')
    }
  }

  const consent = setup?.consent
  const profilesReady =
    setup?.voiceProfile?.status ===
      'ready' &&
    setup?.avatarProfile?.status ===
      'ready'
  const voiceClone =
    setup?.voiceClone
  const voiceCloneIsActive =
    voiceClone?.active === true
  const avatar = setup?.avatar
  const didAvatarIsActive =
    avatar?.active === true
  const chatVoiceInput =
    setup?.chatVoiceInput
  const chatVoiceInputIsActive =
    chatVoiceInput?.active === true

  return (
    <section
      className="digital-persona-setup"
      aria-labelledby="digital-persona-title"
    >
      <div className="persona-heading">
        <div>
          <p className="panel-kicker">
            קלט קולי, קול ואווטאר
          </p>

          <h2 id="digital-persona-title">
            הדמות הדיגיטלית שלי
          </h2>

          <p>
            התמונה המקומית של האווטאר זמינה
            מייד. אפשר להפעיל בנפרד תמלול
            שאלות ב־OpenAI, את קול ElevenLabs
            ואת וידאו D‑ID. אף פעולה חיצונית
            אינה מתבצעת בלי לחיצה מפורשת.
          </p>
        </div>

        <span className="persona-mode-badge">
          {didAvatarIsActive
            ? chatVoiceInputIsActive
              ? 'קלט, קול ואווטאר פעילים'
              : 'קול ואווטאר פעילים'
            : voiceCloneIsActive
              ? chatVoiceInputIsActive
                ? 'קלט וקול אישיים פעילים'
                : 'קול אישי פעיל'
              : chatVoiceInputIsActive
                ? 'קלט קולי פעיל'
                : 'העברה חיצונית חסומה'}
        </span>
      </div>

      {isLoading ? (
        <p
          className="persona-loading"
          aria-live="polite"
        >
          טוענים את מצב הקול והאווטאר...
        </p>
      ) : (
        <>
          {errorMessage && (
            <p
              className="form-error"
              role="alert"
            >
              {errorMessage}
            </p>
          )}

          {successMessage && (
            <p
              className="story-success"
              role="status"
            >
              {successMessage}
            </p>
          )}

          {!consent ? (
            <form
              className="persona-consent-form"
              onSubmit={handleConsentSubmit}
              aria-busy={
                activeAction === 'consent'
              }
            >
              <div className="persona-consent-intro">
                <h3>הסכמה עצמית</h3>

                <p>
                  הטופס מיועד רק למצב שבו
                  אתם האדם המתועד בזיכרון
                  הזה. אי אפשר לאשר באמצעותו
                  שימוש בקול או בדמות של אדם
                  אחר.
                </p>
              </div>

              <label className="persona-name-confirmation">
                <span>
                  הקלידו את שמכם כפי שהוא
                  מופיע בפרופיל
                </span>

                <input
                  type="text"
                  name="subjectNameConfirmation"
                  value={
                    consentForm
                      .subjectNameConfirmation
                  }
                  onChange={
                    handleConsentChange
                  }
                  minLength={2}
                  maxLength={100}
                  required
                />
              </label>

              <div className="persona-consent-checks">
                <label>
                  <input
                    type="checkbox"
                    name="confirmsOwnIdentity"
                    checked={
                      consentForm
                        .confirmsOwnIdentity
                    }
                    onChange={
                      handleConsentChange
                    }
                    required
                  />
                  <span>
                    אני האדם המתועד בפרופיל
                    הזיכרון הזה.
                  </span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    name="permitsVoiceUse"
                    checked={
                      consentForm
                        .permitsVoiceUse
                    }
                    onChange={
                      handleConsentChange
                    }
                    required
                  />
                  <span>
                    אני מתיר להשתמש בדגימות
                    קול שאעלה לצורך יצירת קול
                    AI, לאחר אישור נפרד לספק
                    האמיתי.
                  </span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    name="permitsLikenessUse"
                    checked={
                      consentForm
                        .permitsLikenessUse
                    }
                    onChange={
                      handleConsentChange
                    }
                    required
                  />
                  <span>
                    אני מתיר להשתמש בתמונות
                    או בסרטונים שאעלה לצורך
                    יצירת אווטאר AI, לאחר
                    אישור נפרד לספק האמיתי.
                  </span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    name="understandsAiRepresentation"
                    checked={
                      consentForm
                        .understandsAiRepresentation
                    }
                    onChange={
                      handleConsentChange
                    }
                    required
                  />
                  <span>
                    ברור לי שהקול והאווטאר
                    יהיו יצירת AI ואינם אני,
                    תודעתי או דבריי בזמן אמת.
                  </span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    name="acceptsSafetyRestrictions"
                    checked={
                      consentForm
                        .acceptsSafetyRestrictions
                    }
                    onChange={
                      handleConsentChange
                    }
                    required
                  />
                  <span>
                    לא אשתמש בתוצרים
                    להתחזות, אימות זהות,
                    בנקאות, פוליטיקה, מרמה או
                    הטעיית צד שלישי.
                  </span>
                </label>
              </div>

              <button
                className="primary-button persona-primary-action"
                type="submit"
                data-aura-tooltip="לשמור את ההסכמה להפעלת השכבה הדיגיטלית"
                disabled={
                  activeAction === 'consent'
                }
              >
                {activeAction === 'consent'
                  ? 'שומרים את ההסכמה...'
                  : 'אישור ההסכמה העצמית'}
              </button>
            </form>
          ) : (
            <div className="persona-approved-panel">
              <div className="persona-consent-status">
                <div>
                  <span
                    className="persona-approved-mark"
                    aria-hidden="true"
                  >
                    ✓
                  </span>

                  <div>
                    <h3>
                      ההסכמה העצמית מאושרת
                    </h3>

                    <p>
                      אושרה בתאריך{' '}
                      {formatDate(
                        consent.acceptedAt,
                      )}
                    </p>
                  </div>
                </div>

                <button
                  className="persona-revoke-button"
                  type="button"
                  data-aura-tooltip="לבטל את ההסכמה לקול ולאווטאר"
                  disabled={
                    activeAction === 'revoke'
                  }
                  onClick={
                    handleRevokeConsent
                  }
                >
                  {activeAction === 'revoke'
                    ? 'מבטלים...'
                    : 'ביטול ההסכמה'}
                </button>
              </div>

              <div className="persona-profile-grid">
                <ProfileStatusCard
                  title="פרופיל קול"
                  profile={
                    setup.voiceProfile
                  }
                  readyText={
                    voiceCloneIsActive
                      ? 'קול ElevenLabs v3 אישי פעיל. העברית מזוהה אוטומטית ללא ניקוד חיצוני.'
                      : 'ממשק VoiceProvider פעיל עם ספק Mock.'
                  }
                  waitingText="ייווצר פרופיל בדיקה שאינו מחקה קול אמיתי."
                  readyLabel={
                    voiceCloneIsActive
                      ? 'קול אישי פעיל'
                      : 'מוכן לבדיקה'
                  }
                />

                <ProfileStatusCard
                  title="פרופיל אווטאר"
                  profile={
                    setup.avatarProfile
                  }
                  readyText={
                    didAvatarIsActive
                      ? 'תמונה מסוגננת מקומית והפקת וידאו D‑ID לפי בקשה.'
                      : 'ממשק AvatarProvider פעיל עם אווטאר Mock מסוגנן.'
                  }
                  waitingText="ייווצר אווטאר בדיקה שאינו חיקוי פוטוריאליסטי."
                  readyLabel={
                    didAvatarIsActive
                      ? 'D‑ID פעיל'
                      : 'מוכן לבדיקה'
                  }
                />
              </div>

              {!profilesReady && (
                <button
                  className="primary-button persona-primary-action"
                  type="button"
                  data-aura-tooltip="ליצור פרופילי קול ואווטאר לבדיקה"
                  disabled={
                    activeAction ===
                    'profiles'
                  }
                  onClick={
                    handleInitializeProfiles
                  }
                >
                  {activeAction === 'profiles'
                    ? 'מכינים את הפרופילים...'
                    : 'יצירת פרופילי בדיקה'}
                </button>
              )}

              {profilesReady && (
                <p className="persona-next-stage">
                  פרופילי הבדיקה מוכנים. אפשר להפעיל
                  בנפרד קלט קולי לצ׳אט, קול אישי
                  ואווטאר D‑ID. לכל ספק יש טופס
                  הסכמה משלו.
                </p>
              )}

              <section
                className="persona-voice-clone-panel persona-transcription-panel"
                aria-labelledby="chat-voice-input-title"
              >
                <div className="persona-voice-clone-heading">
                  <div>
                    <p className="panel-kicker">
                      OpenAI Hebrew Transcription
                    </p>

                    <h3 id="chat-voice-input-title">
                      קלט קולי לשיחה
                    </h3>
                  </div>

                  <span
                    className={
                      chatVoiceInputIsActive
                        ? 'persona-status persona-status-ready'
                        : 'persona-status'
                    }
                  >
                    {chatVoiceInputIsActive
                      ? 'פעיל'
                      : 'לא פעיל'}
                  </span>
                </div>

                {chatVoiceInputIsActive ? (
                  <div className="persona-voice-active">
                    <strong>
                      המיקרופון מוכן בצ׳אט
                    </strong>

                    <p>
                      רק לאחר לחיצה על כפתור
                      ההקלטה יישלח קובץ אודיו זמני
                      ל־OpenAI לצורך תמלול בעברית.
                      האפליקציה אינה שומרת אותו
                      כזיכרון. הטקסט יחזור לשדה
                      הכתיבה, ולעולם לא יישלח
                      כהודעה בלי בדיקה ולחיצה שלכם.
                    </p>
                  </div>
                ) : !chatVoiceInput
                    ?.providerConfigured ? (
                  <div className="persona-provider-warning">
                    <strong>
                      תמלול OpenAI עדיין אינו מוגדר
                    </strong>

                    <p>
                      יש להגדיר OPENAI_API_KEY
                      ו־OPENAI_TRANSCRIPTION_MODEL
                      ב־server/.env ולהפעיל מחדש
                      את השרת. המפתח נשמר בשרת בלבד.
                    </p>
                  </div>
                ) : (
                  <form
                    className="persona-voice-consent-form"
                    onSubmit={
                      handleChatVoiceInputSubmit
                    }
                    aria-busy={
                      activeAction ===
                      'chat-voice-input'
                    }
                  >
                    <div className="persona-provider-summary">
                      <p>
                        <strong>
                          מה יוצא מהמחשב?
                        </strong>{' '}
                        רק ההקלטה הקצרה שתבצעו
                        בכפתור המיקרופון. היא תישלח
                        ל־OpenAI לתמלול בעברית ולא
                        תישמר כרשומת זיכרון.
                      </p>

                      <p>
                        התמלול יתווסף לשדה הכתיבה
                        בלבד. אפשר לתקן או למחוק אותו;
                        רק כפתור „שליחת הודעה“ ישלח
                        את הטקסט לשיחה.
                      </p>
                    </div>

                    <div className="persona-consent-checks">
                      <label>
                        <input
                          type="checkbox"
                          name="confirmsOwnVoice"
                          checked={
                            chatVoiceInputForm
                              .confirmsOwnVoice
                          }
                          onChange={
                            handleChatVoiceInputChange
                          }
                          required
                        />
                        <span>
                          אני האדם שידבר במיקרופון,
                          וההקלטה תכיל את הקול שלי.
                        </span>
                      </label>

                      <label>
                        <input
                          type="checkbox"
                          name="permitsOpenAIAudioTransfer"
                          checked={
                            chatVoiceInputForm
                              .permitsOpenAIAudioTransfer
                          }
                          onChange={
                            handleChatVoiceInputChange
                          }
                          required
                        />
                        <span>
                          אני מאשר/ת להעביר ל־OpenAI
                          את ההקלטה שביצעתי לצורך
                          תמלול השאלה לעברית.
                        </span>
                      </label>

                      <label>
                        <input
                          type="checkbox"
                          name="understandsOpenAIProcessing"
                          checked={
                            chatVoiceInputForm
                              .understandsOpenAIProcessing
                          }
                          onChange={
                            handleChatVoiceInputChange
                          }
                          required
                        />
                        <span>
                          ברור לי שהאודיו יעובד אצל
                          OpenAI בהתאם להגדרות החשבון
                          ולמדיניות השירות שלו.
                        </span>
                      </label>

                      <label>
                        <input
                          type="checkbox"
                          name="understandsAudioNotStored"
                          checked={
                            chatVoiceInputForm
                              .understandsAudioNotStored
                          }
                          onChange={
                            handleChatVoiceInputChange
                          }
                          required
                        />
                        <span>
                          ברור לי שהאפליקציה תשתמש
                          באודיו זמנית לתמלול, לא
                          תשמור אותו כזיכרון ותמחק
                          אותו מזיכרון השרת בסיום.
                        </span>
                      </label>

                      <label>
                        <input
                          type="checkbox"
                          name="understandsManualReview"
                          checked={
                            chatVoiceInputForm
                              .understandsManualReview
                          }
                          onChange={
                            handleChatVoiceInputChange
                          }
                          required
                        />
                        <span>
                          ברור לי שהתמלול עשוי לכלול
                          שגיאות, ולכן אבדוק אותו לפני
                          לחיצה ידנית על „שליחת הודעה“.
                        </span>
                      </label>
                    </div>

                    <button
                      className="primary-button persona-primary-action"
                      type="submit"
                      data-aura-tooltip="לאשר ולהפעיל קלט קולי בצ׳אט"
                      disabled={
                        activeAction ===
                        'chat-voice-input'
                      }
                    >
                      {activeAction ===
                      'chat-voice-input'
                        ? 'מפעילים את המיקרופון...'
                        : 'אישור והפעלת קלט קולי'}
                    </button>
                  </form>
                )}
              </section>

              <section
                className="persona-voice-clone-panel"
                aria-labelledby="voice-clone-title"
              >
                <div className="persona-voice-clone-heading">
                  <div>
                    <p className="panel-kicker">
                      ElevenLabs v3
                    </p>

                    <h3 id="voice-clone-title">
                      הפעלת הקול האישי
                    </h3>
                  </div>

                  <span
                    className={
                      voiceCloneIsActive
                        ? 'persona-status persona-status-ready'
                        : 'persona-status'
                    }
                  >
                    {voiceCloneIsActive
                      ? 'פעיל'
                      : 'לא פעיל'}
                  </span>
                </div>

                {voiceCloneIsActive ? (
                  <div className="persona-voice-active">
                    <strong>
                      הקול האישי מוכן
                    </strong>

                    <p>
                      בעת השמעת תשובה
                      בעברית, הטקסט המקורי
                      נשאר כפי שהוא במסך
                      ונשלח ל־ElevenLabs.
                      Eleven v3 מזהה את
                      העברית אוטומטית ומפיק
                      MP3 בקול ה־AI שאושר.
                      קובץ דגימת הקול הפרטי
                      אינו נקרא ואינו נשלח
                      מחדש בכל השמעה.
                    </p>
                  </div>
                ) : !voiceClone
                    ?.providerConfigured ? (
                  <div className="persona-provider-warning">
                    <strong>
                      הספק עדיין אינו מוגדר
                    </strong>

                    <p>
                      יש להוסיף לשרת
                      ELEVENLABS_API_KEY
                      ו־ELEVENLABS_VOICE_ID,
                      ולהפעיל מחדש את השרת.
                      שני הערכים נשמרים
                      בשרת בלבד.
                    </p>
                  </div>
                ) : (
                  <form
                    className="persona-voice-consent-form"
                    onSubmit={
                      handleVoiceCloneSubmit
                    }
                    aria-busy={
                      activeAction ===
                      'voice-clone'
                    }
                  >
                    <div className="persona-provider-summary">
                      <p>
                        <strong>
                          מה יוצא מהמחשב?
                        </strong>{' '}
                        בכל השמעה יוצא רק
                        טקסט התשובה ונשלח
                        ל־ElevenLabs. דגימת
                        הקול נשארת באחסון
                        הפרטי ואינה נפתחת או
                        מועברת על ידי
                        האפליקציה.
                      </p>

                      <p>
                        הקול המשוכפל כבר
                        נמצא בחשבון
                        ElevenLabs שלכם.
                        הטקסט והשמע עשויים
                        להופיע בהיסטוריית
                        החשבון בהתאם להגדרות
                        ולמדיניות ElevenLabs.
                        מצב Zero Retention
                        אינו זמין במסלול
                        Starter.
                      </p>
                    </div>

                    <div className="persona-consent-checks">
                      <label>
                        <input
                          type="checkbox"
                          name="confirmsOwnVoice"
                          checked={
                            voiceCloneForm
                              .confirmsOwnVoice
                          }
                          onChange={
                            handleVoiceCloneChange
                          }
                          required
                        />
                        <span>
                          הקול המשוכפל המוגדר
                          בשרת הוא הקול שלי,
                          ואני מאשר/ת להשתמש
                          בו להקראת תשובות.
                        </span>
                      </label>

                      <label>
                        <input
                          type="checkbox"
                          name="confirmsExistingVoiceClone"
                          checked={
                            voiceCloneForm
                              .confirmsExistingVoiceClone
                          }
                          onChange={
                            handleVoiceCloneChange
                          }
                          required
                        />
                        <span>
                          אני מאשר/ת לקשר את
                          פרופיל הזיכרון הזה
                          לשכפול הקול הקיים
                          בחשבון ElevenLabs
                          שלי.
                        </span>
                      </label>

                      <label>
                        <input
                          type="checkbox"
                          name="permitsElevenLabsTextTransfer"
                          checked={
                            voiceCloneForm
                              .permitsElevenLabsTextTransfer
                          }
                          onChange={
                            handleVoiceCloneChange
                          }
                          required
                        />
                        <span>
                          אני מאשר/ת להעביר
                          ל־ElevenLabs את
                          טקסט התשובה לצורך
                          יצירת אודיו בקול
                          המשוכפל.
                        </span>
                      </label>

                      <label>
                        <input
                          type="checkbox"
                          name="understandsElevenLabsRetention"
                          checked={
                            voiceCloneForm
                              .understandsElevenLabsRetention
                          }
                          onChange={
                            handleVoiceCloneChange
                          }
                          required
                        />
                        <span>
                          ברור לי שהטקסט
                          והשמע עשויים להישמר
                          בהיסטוריית חשבון
                          ElevenLabs, ושמצב
                          Zero Retention אינו
                          זמין במסלול Starter.
                        </span>
                      </label>
                    </div>

                    <button
                      className="primary-button persona-primary-action"
                      type="submit"
                      data-aura-tooltip="לאשר ולהפעיל את הקול האישי"
                      disabled={
                        activeAction ===
                        'voice-clone'
                      }
                    >
                      {activeAction ===
                      'voice-clone'
                        ? 'מפעילים את הקול...'
                        : 'אישור והפעלת הקול האישי'}
                    </button>
                  </form>
                )}
              </section>

              <section
                className="persona-voice-clone-panel persona-avatar-panel"
                aria-labelledby="did-avatar-title"
              >
                <div className="persona-voice-clone-heading">
                  <div>
                    <p className="panel-kicker">
                      D‑ID Photo Avatar
                    </p>

                    <h3 id="did-avatar-title">
                      הפעלת האווטאר המדבר
                    </h3>
                  </div>

                  <span
                    className={
                      didAvatarIsActive
                        ? 'persona-status persona-status-ready'
                        : 'persona-status'
                    }
                  >
                    {didAvatarIsActive
                      ? 'פעיל'
                      : 'לא פעיל'}
                  </span>
                </div>

                <button
                  className="persona-avatar-preview"
                  type="button"
                  data-aura-tooltip="להוסיף או להחליף את תמונת הזיכרון"
                  onClick={onRequestPortrait}
                >
                  {portraitUrl ? (
                    <img
                      src={portraitUrl}
                      alt={`תמונת האווטאר של ${subjectName}`}
                    />
                  ) : (
                    <span
                      className="persona-avatar-placeholder"
                      aria-hidden="true"
                    >
                      {subjectName.trim().charAt(0)}
                    </span>
                  )}

                  <p>
                    {hasPortrait
                      ? 'זו תמונת האדם שנבחרה בפרטי הזיכרון. לחצו כדי להחליף אותה.'
                      : 'עדיין לא הוזנה תמונה של האדם. לחצו כאן כדי לפתוח את עריכת פרטי הזיכרון ולהוסיף תמונה.'}
                  </p>
                </button>

                {didAvatarIsActive ? (
                  <div className="persona-voice-active">
                    <strong>
                      האווטאר ההיברידי מוכן
                    </strong>

                    <p>
                      בשיחה תופיע בקשה נפרדת ליצירת
                      וידאו. השמעת הקול הרגילה לא
                      תשלח דבר ל־D‑ID. בעת בקשת וידאו
                      יישלחו תמונת האווטאר וקובץ הקול
                      שנוצר. השרת יוריד את התוצאה,
                      ימחק ככל האפשר את משאבי D‑ID, ויגיש
                      את הווידאו מהאפליקציה בלי לשלוח
                      את קישור D‑ID לדפדפן.
                    </p>
                  </div>
                ) : !voiceCloneIsActive ? (
                  <div className="persona-provider-warning">
                    <strong>
                      הקול האישי דרוש תחילה
                    </strong>

                    <p>
                      הפעילו מעל את ElevenLabs v3.
                      האווטאר משתמש בקובץ הקול המוכן
                      ולא בדגימת הקול המקורית.
                    </p>
                  </div>
                ) : !hasPortrait ? (
                  <div className="persona-provider-warning">
                    <strong>
                      נדרשת תמונה של האדם
                    </strong>

                    <p>
                      תמונת הזיכרון היא גם תמונת המקור של האווטאר. הוסיפו אותה בעריכת פרטי הזיכרון לפני ההפעלה.
                    </p>
                  </div>
                ) : !avatar?.providerConfigured ? (
                  <div className="persona-provider-warning">
                    <strong>
                      D‑ID עדיין אינו מוגדר בשרת
                    </strong>

                    <p>
                      יש להוסיף DID_API_KEY ל־server/.env,
                      לוודא שקובץ תמונת האווטאר קיים,
                      ולהפעיל את השרת מחדש.
                    </p>
                  </div>
                ) : (
                  <form
                    className="persona-voice-consent-form"
                    onSubmit={handleDIDAvatarSubmit}
                    aria-busy={
                      activeAction === 'did-avatar'
                    }
                  >
                    <div className="persona-provider-summary">
                      <p>
                        <strong>
                          מה נשלח ל־D‑ID?
                        </strong>{' '}
                        רק כאשר תלחצו „יצירת וידאו D‑ID“
                        יישלחו תמונת האווטאר המסוגננת
                        והאודיו שיצר ElevenLabs. טקסט
                        הזיכרון ודגימת הקול המקורית לא
                        יישלחו ל־D‑ID.
                      </p>

                      <p>
                        לפי D‑ID, העלאות הזמניות עשויות
                        להישמר 24–48 שעות. האפליקציה
                        תבקש מחיקה מייד בסיום, אך אין
                        באפשרותה להבטיח מחיקה מיידית
                        במערכות הספק.
                      </p>
                    </div>

                    <div className="persona-consent-checks">
                      <label>
                        <input
                          type="checkbox"
                          name="confirmsOwnLikeness"
                          checked={
                            didAvatarForm.confirmsOwnLikeness
                          }
                          onChange={handleDIDAvatarChange}
                          required
                        />
                        <span>
                          האווטאר מייצג אותי ואני האדם
                          המתועד בפרופיל הזיכרון.
                        </span>
                      </label>

                      <label>
                        <input
                          type="checkbox"
                          name="confirmsAuthorizedAvatarImage"
                          checked={
                            didAvatarForm
                              .confirmsAuthorizedAvatarImage
                          }
                          onChange={handleDIDAvatarChange}
                          required
                        />
                        <span>
                          יש לי רשות להשתמש בתמונת
                          האווטאר המסוגננת שמוצגת כאן.
                        </span>
                      </label>

                      <label>
                        <input
                          type="checkbox"
                          name="permitsDIDImageTransfer"
                          checked={
                            didAvatarForm.permitsDIDImageTransfer
                          }
                          onChange={handleDIDAvatarChange}
                          required
                        />
                        <span>
                          אני מאשר/ת להעביר את תמונת
                          האווטאר ל־D‑ID לצורך הפקת
                          וידאו.
                        </span>
                      </label>

                      <label>
                        <input
                          type="checkbox"
                          name="permitsDIDAudioTransfer"
                          checked={
                            didAvatarForm.permitsDIDAudioTransfer
                          }
                          onChange={handleDIDAvatarChange}
                          required
                        />
                        <span>
                          אני מאשר/ת להעביר ל־D‑ID את
                          קובץ הקול המלאכותי שיצר
                          ElevenLabs.
                        </span>
                      </label>

                      <label>
                        <input
                          type="checkbox"
                          name="understandsDIDRetention"
                          checked={
                            didAvatarForm.understandsDIDRetention
                          }
                          onChange={handleDIDAvatarChange}
                          required
                        />
                        <span>
                          ברור לי שהקבצים עשויים להישמר
                          אצל D‑ID למשך זמן מוגבל, גם
                          כאשר האפליקציה מבקשת מחיקה
                          בסיום ההפקה.
                        </span>
                      </label>
                    </div>

                    <button
                      className="primary-button persona-primary-action"
                      type="submit"
                      data-aura-tooltip="לאשר ולהפעיל את האווטאר המדבר"
                      disabled={
                        activeAction === 'did-avatar'
                      }
                    >
                      {activeAction === 'did-avatar'
                        ? 'מפעילים את האווטאר...'
                        : 'אישור והפעלת D‑ID'}
                    </button>
                  </form>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default DigitalPersonaSetup
