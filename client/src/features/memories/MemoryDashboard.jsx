import {
    useCallback,
    useEffect,
    useState,
  } from 'react'
  import {
    Link,
    useNavigate,
  } from 'react-router'
  import BrandLogo from '../../BrandLogo.jsx'
  import {
    ApiError,
    logoutSession,
    refreshSession,
  } from '../../api/authApi.js'
  import {
    createMemoryProfile,
    listMemoryProfiles,
    updateMemoryProfile,
  } from '../../api/memoryApi.js'
  import {
    uploadMemoryAsset,
  } from '../../api/assetApi.js'
  import {
    createMemoryRecording,
    uploadMemoryRecordingFile,
  } from '../../api/recordingApi.js'
  import './MemoryDashboard.css'

  const emptyForm = {
    subjectName: '',
    subjectGender: '',
    relationship: '',
    description: '',
  }

  const MAX_PORTRAIT_SIZE_BYTES =
    10 * 1024 * 1024

  const MAX_VOICE_SAMPLE_SIZE_BYTES =
    25 * 1024 * 1024

  const VOICE_MIME_TYPES = new Set([
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/wav',
    'audio/x-wav',
    'audio/webm',
  ])

  const DASHBOARD_ICON_PATHS = {
    calendar: (
      <>
        <path d="M8 2v4M16 2v4M3 9h18" />
        <rect x="3" y="4" width="18" height="17" rx="2" />
      </>
    ),
    chevronDown: <path d="m6 9 6 6 6-6" />,
    logout: (
      <>
        <path d="M10 17l5-5-5-5M15 12H3" />
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      </>
    ),
    management: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    message: (
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.6-4.8A8 8 0 1 1 21 15Z" />
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    shieldCheck: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  }

  function DashboardIcon({ name }) {
    return (
      <svg
        className="dashboard-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {DASHBOARD_ICON_PATHS[name]}
      </svg>
    )
  }

  function resolveVoiceMimeType(file) {
    if (VOICE_MIME_TYPES.has(file.type)) {
      return file.type
    }

    const extension = file.name
      .split('.')
      .pop()
      ?.toLocaleLowerCase('en-US')

    return {
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      mp4: 'audio/mp4',
      wav: 'audio/wav',
      webm: 'audio/webm',
    }[extension] ?? ''
  }

  function getMemoryErrorMessage(error) {
    if (!(error instanceof ApiError)) {
      return 'אירעה שגיאה בלתי צפויה. נסו שוב.'
    }

    const messages = {
      VALIDATION_ERROR:
        'חלק מפרטי הזיכרון אינם תקינים.',
      AUTHENTICATION_REQUIRED:
        'החיבור לחשבון הסתיים. יש להתחבר מחדש.',
      NETWORK_ERROR:
        'לא הצלחנו להתחבר לשרת. ודאו שהוא פועל ונסו שוב.',
    }

    return (
      messages[error.code] ??
      'לא הצלחנו להשלים את הפעולה. נסו שוב.'
    )
  }

  function formatDate(value) {
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return ''
    }

    return new Intl.DateTimeFormat(
      'he-IL',
      {
        dateStyle: 'medium',
      },
    ).format(date)
  }

  function MemoryCard({ memoryProfile }) {
    const authorizationRole =
      memoryProfile.authorization?.role ?? 'owner'

    return (
      <article className="memory-card">
        <div className="memory-card-header">
          <div>
            <p className="memory-privacy">
              {memoryProfile.authorization
                ?.role === 'viewer'
                ? 'שותף לצפייה'
                : memoryProfile.authorization
                    ?.role ===
                    'contributor'
                  ? 'שותף לתיעוד'
                  : memoryProfile
                        .authorization
                        ?.role ===
                      'editor'
                    ? 'שותף לעריכה'
                    : memoryProfile
                          .authorization
                          ?.role ===
                        'steward'
                      ? 'נאמן משפחתי'
                      : 'זיכרון פרטי'}
            </p>

            <h3>
              {memoryProfile.subjectName}
            </h3>
          </div>

          <span
            className="memory-initial"
            aria-hidden="true"
          >
            {memoryProfile.subjectName
              .trim()
              .charAt(0)}
          </span>
        </div>

        <div className="memory-relationship-slot">
          {memoryProfile.relationship && (
            <p className="memory-relationship">
              {memoryProfile.relationship}
            </p>
          )}
        </div>

        {memoryProfile.description ? (
          <p className="memory-description">
            {memoryProfile.description}
          </p>
        ) : (
          <p className="memory-description memory-description-empty">
            עדיין לא נוסף תיאור לזיכרון הזה.
          </p>
        )}

        {memoryProfile.createdAt && (
          <p className="memory-created-at">
            <DashboardIcon name="calendar" />
            <span>
              נוצר בתאריך{' '}
              {formatDate(
                memoryProfile.createdAt,
              )}
            </span>
          </p>
        )}

        <div className="memory-card-actions">
          <Link
            className="memory-card-primary-action"
            to={`/app/memories/${memoryProfile.id}`}
            data-aura-tooltip={`להיכנס לזיכרון של ${memoryProfile.subjectName} ולהמשיך בתיעוד`}
          >
            פתיחת המסלול של {memoryProfile.subjectName}
          </Link>

          <details className="memory-card-more-actions">
            <summary data-aura-tooltip="לפתוח את כל אפשרויות הזיכרון">
              <span>פעולות נוספות</span>
              <DashboardIcon name="chevronDown" />
            </summary>

            <div>
              <Link
                className="dashboard-home-link"
                to={`/app/memories/${memoryProfile.id}/pilot`}
                data-aura-tooltip="לפתוח את מסלול הפיילוט המשפחתי"
              >
                פיילוט משפחתי בן 4 שבועות
              </Link>

              {authorizationRole === 'owner' && (
                <Link
                  className="dashboard-home-link"
                  to={`/app/memories/${memoryProfile.id}/pricing-pilot`}
                  data-aura-tooltip="לפתוח את הצעת קבוצת המייסדים"
                >
                  הצעת קבוצת המייסדים
                </Link>
              )}

              {[
                'owner',
                'steward',
              ].includes(authorizationRole) && (
                <Link
                  className="dashboard-home-link"
                  to={`/app/memories/${memoryProfile.id}/family`}
                  data-aura-tooltip="לעבור לניהול בני המשפחה וההרשאות"
                >
                  הזמנת המשפחה וניהול גישה
                </Link>
              )}
            </div>
          </details>
        </div>
      </article>
    )
  }

  function MemoryDashboard({
    authentication,
    onAuthenticationChange,
  }) {
    const navigate = useNavigate()

    const [memoryProfiles, setMemoryProfiles] =
      useState([])

    const [formData, setFormData] =
      useState(emptyForm)

    const [portraitFile, setPortraitFile] =
      useState(null)

    const [voiceSampleFile, setVoiceSampleFile] =
      useState(null)

    const [voiceRightsConfirmed, setVoiceRightsConfirmed] =
      useState(false)

    const [showCreateForm, setShowCreateForm] =
      useState(false)

    const [isLoading, setIsLoading] =
      useState(true)

    const [isSubmitting, setIsSubmitting] =
      useState(false)

    const [isLoggingOut, setIsLoggingOut] =
      useState(false)

    const [errorMessage, setErrorMessage] =
      useState('')

    const [successMessage, setSuccessMessage] =
      useState('')

    const runAuthenticatedRequest = useCallback(
      async (operation) => {
        try {
          return await operation(
            authentication.accessToken,
          )
        } catch (error) {
          if (
            !(error instanceof ApiError) ||
            error.statusCode !== 401
          ) {
            throw error
          }

          try {
            const restoredAuthentication =
              await refreshSession()

            onAuthenticationChange(
              restoredAuthentication,
            )

            return await operation(
              restoredAuthentication.accessToken,
            )
          } catch (refreshError) {
            onAuthenticationChange(null)

            navigate('/login', {
              replace: true,
            })

            throw refreshError
          }
        }
      },
      [
        authentication.accessToken,
        navigate,
        onAuthenticationChange,
      ],
    )

    useEffect(() => {
      let isActive = true

      async function loadMemoryProfiles() {
        setIsLoading(true)
        setErrorMessage('')

        try {
          const profiles =
            await runAuthenticatedRequest(
              listMemoryProfiles,
            )

          if (isActive) {
            setMemoryProfiles(profiles)
          }
        } catch (error) {
          if (isActive) {
            setErrorMessage(
              getMemoryErrorMessage(error),
            )
          }
        } finally {
          if (isActive) {
            setIsLoading(false)
          }
        }
      }

      loadMemoryProfiles()

      return () => {
        isActive = false
      }
    }, [runAuthenticatedRequest])

    function handleFormChange(event) {
      const { name, value } = event.target

      setFormData((current) => ({
        ...current,
        [name]: value,
      }))
    }

    async function handleCreateMemory(event) {
      event.preventDefault()
      setErrorMessage('')
      setSuccessMessage('')

      if (
        portraitFile &&
        (
          ![
            'image/jpeg',
            'image/png',
            'image/webp',
          ].includes(portraitFile.type) ||
          portraitFile.size < 1 ||
          portraitFile.size >
            MAX_PORTRAIT_SIZE_BYTES
        )
      ) {
        setErrorMessage(
          'תמונת האדם חייבת להיות JPG, PNG או WebP ובגודל של עד 10 MB.',
        )
        return
      }

      const voiceMimeType =
        voiceSampleFile
          ? resolveVoiceMimeType(
              voiceSampleFile,
            )
          : ''

      if (
        voiceSampleFile &&
        (
          !voiceMimeType ||
          voiceSampleFile.size < 1 ||
          voiceSampleFile.size >
            MAX_VOICE_SAMPLE_SIZE_BYTES
        )
      ) {
        setErrorMessage(
          'דגימת הקול חייבת להיות MP3, M4A, MP4, WAV או WebM ובגודל של עד 25 MB.',
        )
        return
      }

      if (
        voiceSampleFile &&
        !voiceRightsConfirmed
      ) {
        setErrorMessage(
          'כדי לשמור את דגימת הקול יש לאשר שיש לכם רשות לשמור ולהשמיע אותה בארכיון.',
        )
        return
      }

      setIsSubmitting(true)

      let createdProfile = null

      try {
        createdProfile =
          await runAuthenticatedRequest(
            (accessToken) =>
              createMemoryProfile(
                accessToken,
                formData,
              ),
          )

        const profileMedia = {}

        if (portraitFile) {
          const portraitAsset =
            await runAuthenticatedRequest(
              (accessToken) =>
                uploadMemoryAsset(
                  accessToken,
                  createdProfile.id,
                  {
                    file: portraitFile,
                    displayName:
                      `תמונת הפרופיל של ${createdProfile.subjectName}`,
                    description:
                      'התמונה הראשית שנבחרה עבור האדם בארכיון.',
                  },
                ),
            )

          profileMedia.portraitAssetId =
            portraitAsset.id
        }

        if (voiceSampleFile) {
          const voiceRecording =
            await runAuthenticatedRequest(
              (accessToken) =>
                createMemoryRecording(
                  accessToken,
                  createdProfile.id,
                  {
                    displayName:
                      `דגימת הקול של ${createdProfile.subjectName}`,
                    originalFileName:
                      voiceSampleFile.name,
                    mimeType:
                      voiceMimeType,
                    sizeBytes:
                      voiceSampleFile.size,
                    languageCode: 'he',
                    consent: {
                      confirmed: true,
                      basis:
                        'rights_holder',
                      permittedUses: [
                        'recording_playback',
                      ],
                    },
                  },
                ),
            )

          const storedRecording =
            await runAuthenticatedRequest(
              (accessToken) =>
                uploadMemoryRecordingFile(
                  accessToken,
                  createdProfile.id,
                  voiceRecording.id,
                  voiceSampleFile,
                ),
            )

          profileMedia.voiceSampleRecordingId =
            storedRecording.id
        }

        if (
          Object.keys(profileMedia).length > 0
        ) {
          createdProfile =
            await runAuthenticatedRequest(
              (accessToken) =>
                updateMemoryProfile(
                  accessToken,
                  createdProfile.id,
                  profileMedia,
                ),
            )
        }

        setMemoryProfiles((current) => [
          createdProfile,
          ...current,
        ])

        setFormData(emptyForm)
        setPortraitFile(null)
        setVoiceSampleFile(null)
        setVoiceRightsConfirmed(false)
        setShowCreateForm(false)

        setSuccessMessage(
          `הזיכרון של ${createdProfile.subjectName} נוצר בהצלחה.`,
        )

        navigate(
          `/app/memories/${createdProfile.id}?tab=documentation#guided-interview`,
          {
            state: {
              startGuidedInterview: true,
            },
          },
        )
      } catch (error) {
        if (createdProfile) {
          setMemoryProfiles((current) => [
            createdProfile,
            ...current.filter(
              (profile) =>
                profile.id !==
                createdProfile.id,
            ),
          ])

          navigate(
            `/app/memories/${createdProfile.id}`,
            {
              state: {
                profileSetupWarning:
                  'הארכיון נוצר, אך אחד מקובצי ההקמה לא נשמר. פתחו את עריכת פרטי הזיכרון ונסו להעלות אותו שוב.',
              },
            },
          )
          return
        }

        setErrorMessage(
          getMemoryErrorMessage(error),
        )
      } finally {
        setIsSubmitting(false)
      }
    }

    async function handleLogout() {
      setErrorMessage('')
      setIsLoggingOut(true)

      try {
        await logoutSession()
        onAuthenticationChange(null)

        navigate('/', {
          replace: true,
        })
      } catch (error) {
        setErrorMessage(
          getMemoryErrorMessage(error),
        )
      } finally {
        setIsLoggingOut(false)
      }
    }

    const user = authentication.user

    return (
      <main className="page-shell">
        <section
          className="surface-card dashboard-card"
          aria-labelledby="dashboard-title"
        >
          <header className="dashboard-header">
            <div className="dashboard-identity">
              <BrandLogo className="dashboard-brand-logo" compact />

              <div>
                <p className="eyebrow">
                  האזור האישי
                </p>

                <h1
                  className="dashboard-title"
                  id="dashboard-title"
                >
                  שלום, {user.displayName}
                </h1>

                <p>{user.email}</p>
              </div>
            </div>

            <div className="dashboard-header-actions">
              {user.systemRole === 'admin' && (
                <Link
                  className="secondary-button admin-dashboard-link"
                  to="/app/admin"
                  data-aura-tooltip="מעבר לכלי הניהול של המערכת"
                >
                  <DashboardIcon name="management" />
                  פתיחת לוח הניהול
                </Link>
              )}

              <button
                className="secondary-button"
                type="button"
                data-aura-tooltip="יציאה בטוחה מהחשבון"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                <DashboardIcon name="logout" />
                {isLoggingOut
                  ? 'מתנתקים...'
                  : 'התנתקות'}
              </button>
            </div>
          </header>

          <div className="account-status">
            <span aria-hidden="true">
              <DashboardIcon name="shieldCheck" />
            </span>

            <div>
              <strong>
                החשבון מחובר ומאומת
              </strong>

              <p>
                הזיכרונות שתיצרו פרטיים
                כברירת מחדל ושייכים לחשבון
                שלכם בלבד.
              </p>
            </div>
          </div>

          <section
            className="guided-living-dashboard-intro"
            aria-labelledby="guided-living-dashboard-title"
          >
            <div className="guided-living-dashboard-copy">
              <p className="panel-kicker">זיכרון חי למשפחה</p>

              <h2 id="guided-living-dashboard-title">
                הסיפורים של המשפחה שלכם. מוכנים לשאלה הבאה.
              </h2>

              <p>
                מתעדים בשיחות קצרות וטבעיות, שומרים את הסיפור ואת הקול
                המקורי, ומקבלים תשובות שמראות על מה הן מבוססות.
              </p>

              <ol aria-label="איך המסלול עובד">
                <li>
                  <DashboardIcon name="users" />
                  <span>1</span>
                  <strong>מדברים</strong>
                </li>
                <li>
                  <DashboardIcon name="shieldCheck" />
                  <span>2</span>
                  <strong>שומרים מקור</strong>
                </li>
                <li>
                  <DashboardIcon name="message" />
                  <span>3</span>
                  <strong>המשפחה שואלת</strong>
                </li>
              </ol>
            </div>
          </section>

          <div className="memory-toolbar dashboard-memory-section">
            <div>
              <p className="panel-kicker">
                הארכיונים המשפחתיים
              </p>

              <h2 id="dashboard-memories-title">
                של מי הסיפורים שנרצה לשמור?
              </h2>
            </div>

            <button
              className="primary-button"
              type="button"
              data-aura-tooltip={
                showCreateForm
                  ? 'לסגור את טופס הארכיון החדש'
                  : 'ליצור זיכרון משפחתי חדש'
              }
              onClick={() => {
                setShowCreateForm(
                  (current) => !current,
                )

                setErrorMessage('')
                setSuccessMessage('')
              }}
            >
              {!showCreateForm && (
                <DashboardIcon name="plus" />
              )}
              {showCreateForm
                ? 'סגירת הטופס'
                : memoryProfiles.length > 0
                  ? 'התחלת ארכיון נוסף'
                  : 'התחלת ארכיון ראשון'}
            </button>
          </div>

          {showCreateForm && (
            <form
              className="memory-form"
              onSubmit={handleCreateMemory}
              aria-busy={isSubmitting}
            >
              <div className="memory-form-heading">
                <h2>
                  של מי את הסיפורים היית רוצה לשמור?
                </h2>

                <p>
                  מתחילים בשם ובקשר המשפחתי,
                  וממשיכים מיד לשאלה אנושית
                  אחת מתוך ראיון קצר ומודרך.
                </p>
              </div>

              <div className="memory-form-grid">
                <label className="form-field">
                  <span>שם המספר או המספרת</span>

                  <input
                    type="text"
                    name="subjectName"
                    value={
                      formData.subjectName
                    }
                    onChange={handleFormChange}
                    minLength={2}
                    maxLength={100}
                    autoFocus
                    required
                  />
                </label>

                <fieldset className="memory-gender-field">
                  <legend>איך לפנות אל האדם?</legend>

                  <label>
                    <input
                      type="radio"
                      name="subjectGender"
                      value="female"
                      checked={
                        formData.subjectGender ===
                        'female'
                      }
                      onChange={handleFormChange}
                      required
                    />
                    <span>נקבה</span>
                  </label>

                  <label>
                    <input
                      type="radio"
                      name="subjectGender"
                      value="male"
                      checked={
                        formData.subjectGender ===
                        'male'
                      }
                      onChange={handleFormChange}
                      required
                    />
                    <span>זכר</span>
                  </label>
                </fieldset>

                <label className="form-field">
                  <span>
                    {formData.subjectGender === 'female'
                      ? 'מה הקשר שלך אליה?'
                      : formData.subjectGender === 'male'
                        ? 'מה הקשר שלך אליו?'
                        : 'מה הקשר שלך אל האדם?'}
                  </span>

                  <input
                    type="text"
                    name="relationship"
                    value={
                      formData.relationship
                    }
                    onChange={handleFormChange}
                    maxLength={80}
                    placeholder="לדוגמה: סבתא, אבא, חבר"
                  />
                </label>
              </div>

              <section className="memory-profile-media-fields">
                <label className="memory-media-field">
                  <span className="memory-media-field-title">
                    תמונת האדם
                  </span>

                  <span className="memory-media-field-copy">
                    זו תהיה התמונה הראשית של הזיכרון ובהמשך גם תמונת המקור לאווטאר. אם לא תבחרו תמונה יוצג עיצוב זיכרון כללי.
                  </span>

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) =>
                      setPortraitFile(
                        event.target.files?.[0] ??
                        null,
                      )
                    }
                  />

                  {portraitFile && (
                    <strong>
                      נבחרה: {portraitFile.name}
                    </strong>
                  )}
                </label>

                <div className="memory-media-field">
                  <label>
                    <span className="memory-media-field-title">
                      דגימת הקול
                    </span>

                    <span className="memory-media-field-copy">
                      העלו הקלטה ברורה של האדם. היא תישמר כמקור קולי פרטי לקראת שלב הקול, אך לא תפעיל שכפול קול אוטומטית.
                    </span>

                    <input
                      type="file"
                      accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/webm"
                      onChange={(event) => {
                        const file =
                          event.target.files?.[0] ??
                          null

                        setVoiceSampleFile(file)

                        if (!file) {
                          setVoiceRightsConfirmed(false)
                        }
                      }}
                    />
                  </label>

                  {voiceSampleFile && (
                    <>
                      <strong>
                        נבחרה: {voiceSampleFile.name}
                      </strong>

                      <label className="memory-voice-rights">
                        <input
                          type="checkbox"
                          checked={voiceRightsConfirmed}
                          onChange={(event) =>
                            setVoiceRightsConfirmed(
                              event.target.checked,
                            )
                          }
                        />
                        <span>
                          יש לי רשות לשמור ולהשמיע את ההקלטה בתוך הארכיון המשפחתי.
                        </span>
                      </label>
                    </>
                  )}
                </div>
              </section>

              <details className="memory-optional-context">
                <summary data-aura-tooltip="לפתוח שדה לתיאור קצר של הזיכרון">רוצים להוסיף מעט הקשר? לא חובה</summary>

                <label className="form-field">
                  <span>מה חשוב למשפחה לשמור?</span>

                  <textarea
                    className="memory-textarea"
                    name="description"
                    value={formData.description}
                    onChange={handleFormChange}
                    maxLength={1000}
                    rows={5}
                    placeholder="כמה מילים שיעזרו לנו להציע שאלות מתאימות"
                  />
                </label>
              </details>

              <div className="memory-form-actions">
                <button
                  className="primary-button"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'שומרים...'
                    : 'יצירת הארכיון והתחלת הראיון'}
                </button>

                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false)
                    setFormData(emptyForm)
                    setPortraitFile(null)
                    setVoiceSampleFile(null)
                    setVoiceRightsConfirmed(false)
                  }}
                  disabled={isSubmitting}
                >
                  ביטול
                </button>
              </div>
            </form>
          )}

          {errorMessage && (
            <p
              className="form-error memory-message"
              role="alert"
            >
              {errorMessage}
            </p>
          )}

          {successMessage && (
            <p
              className="form-notice memory-message"
              role="status"
            >
              {successMessage}
            </p>
          )}

          {isLoading ? (
            <div
              className="memory-loading"
              aria-live="polite"
            >
              <span
                className="loading-indicator"
                aria-hidden="true"
              />

              <p>טוענים את הזיכרונות...</p>
            </div>
          ) : memoryProfiles.length === 0 ? (
            <section className="memory-empty-state">
              <div
                className="memory-empty-icon"
                aria-hidden="true"
              >
                +
              </div>

              <h2>
                עדיין לא התחלתם ארכיון משפחתי
              </h2>

              <p>
                לחצו על “התחלת ארכיון ראשון”,
                בחרו את האדם שאת סיפוריו תרצו
                לשמור וקבלו שאלה ראשונה.
              </p>
            </section>
          ) : (
            <section
              className="memory-list"
              aria-label="רשימת הזיכרונות"
            >
              {memoryProfiles.map(
                (memoryProfile) => (
                  <MemoryCard
                    key={memoryProfile.id}
                    memoryProfile={
                      memoryProfile
                    }
                  />
                ),
              )}
            </section>
          )}

          <footer className="dashboard-footer">
            <Link
              className="dashboard-home-link"
              to="/"
              data-aura-tooltip="לחזור לעמוד הפתיחה של זיכרון חי"
            >
              חזרה לעמוד הראשי
            </Link>
          </footer>
        </section>
      </main>
    )
  }

  export default MemoryDashboard
