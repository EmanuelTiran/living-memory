import {
    useCallback,
    useEffect,
    useState,
  } from 'react'
  import {
    Link,
    useNavigate,
    useParams,
  } from 'react-router'
  import {
    ApiError,
    refreshSession,
  } from '../../api/authApi.js'
  import {
    approveMemoryStory,
    archiveMemoryProfile,
    archiveMemoryStory,
    createMemoryStory,
    getMemoryProfile,
    listMemoryStories,
    updateMemoryProfile,
    updateMemoryStory,
  } from '../../api/memoryApi.js'
  import './MemoryProfilePage.css'
  import './MemoryProfileManagement.css'

  function getErrorMessage(error) {
    if (!(error instanceof ApiError)) {
      return 'אירעה שגיאה בלתי צפויה.'
    }

    const messages = {
      MEMORY_NOT_FOUND:
        'הזיכרון לא נמצא או שאין לכם הרשאה לצפות בו.',
      STORY_NOT_FOUND:
        'הסיפור לא נמצא או שאינו זמין יותר.',
      VALIDATION_ERROR:
        'חלק מהפרטים אינם תקינים. בדקו את הטופס ונסו שוב.',
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
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return ''
    }

    return new Intl.DateTimeFormat(
      'he-IL',
      {
        dateStyle: 'long',
      },
    ).format(date)
  }

  function formatDateOnly(value) {
    if (!value) {
      return ''
    }

    const [year, month, day] = value
      .split('-')
      .map(Number)

    const date = new Date(
      Date.UTC(year, month - 1, day),
    )

    if (Number.isNaN(date.getTime())) {
      return value
    }

    return new Intl.DateTimeFormat(
      'he-IL',
      {
        dateStyle: 'long',
        timeZone: 'UTC',
      },
    ).format(date)
  }

  function getStoryStatusLabel(status) {
    if (status === 'approved') {
      return 'מאושר'
    }

    return 'טיוטה'
  }

  function MemoryProfilePage({
    authentication,
    onAuthenticationChange,
  }) {
    const { memoryId } = useParams()
    const navigate = useNavigate()

    const [memoryProfile, setMemoryProfile] =
      useState(null)

    const [memoryStories, setMemoryStories] =
      useState([])

    const [profileForm, setProfileForm] =
      useState({
        subjectName: '',
        relationship: '',
        description: '',
      })

    const [storyForm, setStoryForm] =
      useState({
        title: '',
        content: '',
        occurredOn: '',
      })

    const [editForm, setEditForm] =
      useState({
        title: '',
        content: '',
        occurredOn: '',
      })

    const [isLoading, setIsLoading] =
      useState(true)

    const [
      isEditingProfile,
      setIsEditingProfile,
    ] = useState(false)

    const [
      isUpdatingProfile,
      setIsUpdatingProfile,
    ] = useState(false)

    const [
      isArchivingProfile,
      setIsArchivingProfile,
    ] = useState(false)

    const [isSubmitting, setIsSubmitting] =
      useState(false)

    const [
      approvingStoryId,
      setApprovingStoryId,
    ] = useState('')

    const [
      updatingStoryId,
      setUpdatingStoryId,
    ] = useState('')

    const [
      archivingStoryId,
      setArchivingStoryId,
    ] = useState('')

    const [
      editingStoryId,
      setEditingStoryId,
    ] = useState('')

    const [errorMessage, setErrorMessage] =
      useState('')

    const [
      profileActionError,
      setProfileActionError,
    ] = useState('')

    const [
      profileActionSuccess,
      setProfileActionSuccess,
    ] = useState('')

    const [
      storyErrorMessage,
      setStoryErrorMessage,
    ] = useState('')

    const [
      storySuccessMessage,
      setStorySuccessMessage,
    ] = useState('')

    const [
      storyActionErrorMessage,
      setStoryActionErrorMessage,
    ] = useState('')

    const [
      storyActionSuccessMessage,
      setStoryActionSuccessMessage,
    ] = useState('')

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

      async function loadMemory() {
        setIsLoading(true)
        setErrorMessage('')

        try {
          const [
            profile,
            stories,
          ] = await runAuthenticatedRequest(
            (accessToken) =>
              Promise.all([
                getMemoryProfile(
                  accessToken,
                  memoryId,
                ),
                listMemoryStories(
                  accessToken,
                  memoryId,
                ),
              ]),
          )

          if (isActive) {
            setMemoryProfile(profile)
            setMemoryStories(stories)
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

      loadMemory()

      return () => {
        isActive = false
      }
    }, [
      memoryId,
      runAuthenticatedRequest,
    ])

    function startEditingProfile() {
      setProfileForm({
        subjectName:
          memoryProfile.subjectName,
        relationship:
          memoryProfile.relationship ?? '',
        description:
          memoryProfile.description ?? '',
      })

      setProfileActionError('')
      setProfileActionSuccess('')
      setIsEditingProfile(true)
    }

    function cancelEditingProfile() {
      setIsEditingProfile(false)

      setProfileForm({
        subjectName: '',
        relationship: '',
        description: '',
      })
    }

    function handleProfileChange(event) {
      const { name, value } = event.target

      setProfileForm((current) => ({
        ...current,
        [name]: value,
      }))
    }

    async function handleProfileSubmit(event) {
      event.preventDefault()

      setIsUpdatingProfile(true)
      setProfileActionError('')
      setProfileActionSuccess('')

      try {
        const updatedProfile =
          await runAuthenticatedRequest(
            (accessToken) =>
              updateMemoryProfile(
                accessToken,
                memoryId,
                profileForm,
              ),
          )

        setMemoryProfile(updatedProfile)
        cancelEditingProfile()

        setProfileActionSuccess(
          'פרטי הזיכרון עודכנו בהצלחה.',
        )
      } catch (error) {
        setProfileActionError(
          getErrorMessage(error),
        )
      } finally {
        setIsUpdatingProfile(false)
      }
    }

    async function handleArchiveProfile() {
      const shouldArchive = window.confirm(
        `האם להעביר את הזיכרון של "${memoryProfile.subjectName}" לארכיון? הסיפורים לא יימחקו.`,
      )

      if (!shouldArchive) {
        return
      }

      setIsArchivingProfile(true)
      setProfileActionError('')
      setProfileActionSuccess('')

      try {
        await runAuthenticatedRequest(
          (accessToken) =>
            archiveMemoryProfile(
              accessToken,
              memoryId,
            ),
        )

        navigate('/app', {
          replace: true,
        })
      } catch (error) {
        setProfileActionError(
          getErrorMessage(error),
        )

        setIsArchivingProfile(false)
      }
    }

    function handleStoryChange(event) {
      const { name, value } = event.target

      setStoryForm((current) => ({
        ...current,
        [name]: value,
      }))
    }

    function handleEditChange(event) {
      const { name, value } = event.target

      setEditForm((current) => ({
        ...current,
        [name]: value,
      }))
    }

    function startEditingStory(story) {
      setEditingStoryId(story.id)

      setEditForm({
        title: story.title,
        content: story.content,
        occurredOn:
          story.occurredOn ?? '',
      })

      setStoryActionErrorMessage('')
      setStoryActionSuccessMessage('')
    }

    function cancelEditingStory() {
      setEditingStoryId('')

      setEditForm({
        title: '',
        content: '',
        occurredOn: '',
      })
    }

    async function handleStorySubmit(event) {
      event.preventDefault()

      setIsSubmitting(true)
      setStoryErrorMessage('')
      setStorySuccessMessage('')

      try {
        const input = {
          title: storyForm.title,
          content: storyForm.content,
        }

        if (storyForm.occurredOn) {
          input.occurredOn =
            storyForm.occurredOn
        }

        const memoryStory =
          await runAuthenticatedRequest(
            (accessToken) =>
              createMemoryStory(
                accessToken,
                memoryId,
                input,
              ),
          )

        setMemoryStories((current) => [
          memoryStory,
          ...current,
        ])

        setStoryForm({
          title: '',
          content: '',
          occurredOn: '',
        })

        setStorySuccessMessage(
          'הסיפור נשמר בהצלחה כטיוטה.',
        )
      } catch (error) {
        setStoryErrorMessage(
          getErrorMessage(error),
        )
      } finally {
        setIsSubmitting(false)
      }
    }

    async function handleApproveStory(storyId) {
      setApprovingStoryId(storyId)
      setStoryActionErrorMessage('')
      setStoryActionSuccessMessage('')

      try {
        const approvedStory =
          await runAuthenticatedRequest(
            (accessToken) =>
              approveMemoryStory(
                accessToken,
                memoryId,
                storyId,
              ),
          )

        setMemoryStories((current) =>
          current.map((story) =>
            story.id === approvedStory.id
              ? approvedStory
              : story,
          ),
        )

        setStoryActionSuccessMessage(
          'הסיפור אושר בהצלחה.',
        )
      } catch (error) {
        setStoryActionErrorMessage(
          getErrorMessage(error),
        )
      } finally {
        setApprovingStoryId('')
      }
    }

    async function handleEditSubmit(
      event,
      storyId,
    ) {
      event.preventDefault()

      setUpdatingStoryId(storyId)
      setStoryActionErrorMessage('')
      setStoryActionSuccessMessage('')

      try {
        const updatedStory =
          await runAuthenticatedRequest(
            (accessToken) =>
              updateMemoryStory(
                accessToken,
                memoryId,
                storyId,
                {
                  title: editForm.title,
                  content: editForm.content,
                  occurredOn:
                    editForm.occurredOn,
                },
              ),
          )

        setMemoryStories((current) =>
          current.map((story) =>
            story.id === updatedStory.id
              ? updatedStory
              : story,
          ),
        )

        cancelEditingStory()

        setStoryActionSuccessMessage(
          'הסיפור עודכן וחזר למצב טיוטה לצורך אישור מחדש.',
        )
      } catch (error) {
        setStoryActionErrorMessage(
          getErrorMessage(error),
        )
      } finally {
        setUpdatingStoryId('')
      }
    }

    async function handleArchiveStory(story) {
      const shouldArchive = window.confirm(
        `האם להעביר את הסיפור "${story.title}" לארכיון?`,
      )

      if (!shouldArchive) {
        return
      }

      setArchivingStoryId(story.id)
      setStoryActionErrorMessage('')
      setStoryActionSuccessMessage('')

      try {
        await runAuthenticatedRequest(
          (accessToken) =>
            archiveMemoryStory(
              accessToken,
              memoryId,
              story.id,
            ),
        )

        setMemoryStories((current) =>
          current.filter(
            (currentStory) =>
              currentStory.id !== story.id,
          ),
        )

        if (editingStoryId === story.id) {
          cancelEditingStory()
        }

        setStoryActionSuccessMessage(
          'הסיפור הועבר לארכיון.',
        )
      } catch (error) {
        setStoryActionErrorMessage(
          getErrorMessage(error),
        )
      } finally {
        setArchivingStoryId('')
      }
    }

    function isStoryBusy(storyId) {
      return (
        approvingStoryId === storyId ||
        updatingStoryId === storyId ||
        archivingStoryId === storyId
      )
    }

    if (isLoading) {
      return (
        <main className="page-shell">
          <section
            className="surface-card loading-card"
            aria-live="polite"
          >
            <span
              className="loading-indicator"
              aria-hidden="true"
            />

            <p>טוענים את הזיכרון...</p>
          </section>
        </main>
      )
    }

    if (errorMessage || !memoryProfile) {
      return (
        <main className="page-shell">
          <section className="surface-card profile-error-card">
            <p
              className="form-error"
              role="alert"
            >
              {errorMessage}
            </p>

            <Link
              className="secondary-button"
              to="/app"
            >
              חזרה לזיכרונות שלי
            </Link>
          </section>
        </main>
      )
    }

    const isProfileBusy =
      isUpdatingProfile ||
      isArchivingProfile

    return (
      <main className="page-shell">
        <section
          className="surface-card memory-profile-page"
          aria-labelledby="memory-profile-title"
        >
          <div className="memory-profile-toolbar">
            <Link
              className="back-link"
              to="/app"
            >
              חזרה לזיכרונות שלי
            </Link>

            <div className="profile-management-actions">
              <button
                className="profile-management-button profile-edit-button"
                type="button"
                disabled={isProfileBusy}
                onClick={startEditingProfile}
              >
                עריכת פרטי הזיכרון
              </button>

              <button
                className="profile-management-button profile-archive-button"
                type="button"
                disabled={isProfileBusy}
                onClick={handleArchiveProfile}
              >
                {isArchivingProfile
                  ? 'מעבירים לארכיון...'
                  : 'העברת הזיכרון לארכיון'}
              </button>
            </div>
          </div>

          <header className="memory-profile-header">
            <span
              className="profile-initial"
              aria-hidden="true"
            >
              {memoryProfile.subjectName
                .trim()
                .charAt(0)}
            </span>

            <div>
              <p className="memory-privacy">
                זיכרון פרטי
              </p>

              <h1
                id="memory-profile-title"
                className="memory-profile-title"
              >
                {memoryProfile.subjectName}
              </h1>

              {memoryProfile.relationship && (
                <p className="profile-relationship">
                  {memoryProfile.relationship}
                </p>
              )}
            </div>
          </header>

          {profileActionError && (
            <p
              className="form-error profile-action-message"
              role="alert"
            >
              {profileActionError}
            </p>
          )}

          {profileActionSuccess && (
            <p
              className="story-success profile-action-message"
              role="status"
            >
              {profileActionSuccess}
            </p>
          )}

          {isEditingProfile && (
            <section
              className="profile-edit-panel"
              aria-labelledby="profile-edit-title"
            >
              <h2 id="profile-edit-title">
                עריכת פרטי הזיכרון
              </h2>

              <form
                className="profile-edit-form"
                onSubmit={handleProfileSubmit}
                aria-busy={isUpdatingProfile}
              >
                <label>
                  <span>שם האדם</span>

                  <input
                    type="text"
                    name="subjectName"
                    value={
                      profileForm.subjectName
                    }
                    onChange={
                      handleProfileChange
                    }
                    minLength={2}
                    maxLength={100}
                    required
                  />
                </label>

                <label>
                  <span>
                    הקשר המשפחתי
                  </span>

                  <input
                    type="text"
                    name="relationship"
                    value={
                      profileForm.relationship
                    }
                    onChange={
                      handleProfileChange
                    }
                    maxLength={80}
                  />
                </label>

                <label className="profile-description-field">
                  <span>תיאור הזיכרון</span>

                  <textarea
                    name="description"
                    value={
                      profileForm.description
                    }
                    onChange={
                      handleProfileChange
                    }
                    maxLength={1000}
                    rows={5}
                  />
                </label>

                <div className="profile-edit-actions">
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={isUpdatingProfile}
                  >
                    {isUpdatingProfile
                      ? 'שומרים...'
                      : 'שמירת השינויים'}
                  </button>

                  <button
                    className="secondary-button"
                    type="button"
                    disabled={isUpdatingProfile}
                    onClick={
                      cancelEditingProfile
                    }
                  >
                    ביטול
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="profile-overview">
            <div>
              <p className="panel-kicker">
                על האדם
              </p>

              <h2>
                הסיפור שמאחורי הזיכרון
              </h2>

              <p>
                {memoryProfile.description ||
                  'עדיין לא נוסף תיאור לזיכרון הזה.'}
              </p>
            </div>

            {memoryProfile.createdAt && (
              <dl className="profile-metadata">
                <div>
                  <dt>נוצר בתאריך</dt>

                  <dd>
                    {formatDate(
                      memoryProfile.createdAt,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>פרטיות</dt>
                  <dd>פרטי לחשבון שלך</dd>
                </div>
              </dl>
            )}
          </section>

          <section
            className="story-workspace"
            aria-labelledby="stories-title"
          >
            <div className="story-form-panel">
              <div className="story-section-header">
                <p className="panel-kicker">
                  מקור כתוב
                </p>

                <h2 id="stories-title">
                  הוספת סיפור חיים
                </h2>

                <p>
                  כתבו אירוע, זיכרון או סיפור
                  משפחתי. הסיפור יישמר תחילה
                  כטיוטה.
                </p>
              </div>

              <form
                className="story-form"
                onSubmit={handleStorySubmit}
                aria-busy={isSubmitting}
              >
                <label className="form-field">
                  <span>כותרת הסיפור</span>

                  <input
                    type="text"
                    name="title"
                    value={storyForm.title}
                    onChange={handleStoryChange}
                    minLength={2}
                    maxLength={160}
                    required
                  />
                </label>

                <label className="form-field">
                  <span>תוכן הסיפור</span>

                  <textarea
                    name="content"
                    value={storyForm.content}
                    onChange={handleStoryChange}
                    minLength={10}
                    maxLength={20000}
                    rows={8}
                    required
                  />
                </label>

                <label className="form-field">
                  <span>
                    מתי זה קרה? לא חובה
                  </span>

                  <input
                    type="date"
                    name="occurredOn"
                    value={storyForm.occurredOn}
                    onChange={handleStoryChange}
                  />
                </label>

                {storyErrorMessage && (
                  <p
                    className="form-error"
                    role="alert"
                  >
                    {storyErrorMessage}
                  </p>
                )}

                {storySuccessMessage && (
                  <p
                    className="story-success"
                    role="status"
                  >
                    {storySuccessMessage}
                  </p>
                )}

                <button
                  className="primary-button story-submit-button"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'שומרים את הסיפור...'
                    : 'שמירת הסיפור'}
                </button>
              </form>
            </div>

            <div className="story-list-panel">
              <div className="story-list-heading">
                <div>
                  <p className="panel-kicker">
                    סיפורי חיים
                  </p>

                  <h2>
                    הסיפורים שנשמרו
                  </h2>
                </div>

                <span className="story-count">
                  {memoryStories.length}
                </span>
              </div>

              {storyActionErrorMessage && (
                <p
                  className="form-error story-action-message"
                  role="alert"
                >
                  {storyActionErrorMessage}
                </p>
              )}

              {storyActionSuccessMessage && (
                <p
                  className="story-success story-action-message"
                  role="status"
                >
                  {storyActionSuccessMessage}
                </p>
              )}

              {memoryStories.length === 0 ? (
                <div className="empty-stories">
                  <strong>
                    עדיין אין סיפורים
                  </strong>

                  <p>
                    הסיפור הראשון שתוסיפו
                    יופיע כאן.
                  </p>
                </div>
              ) : (
                <div className="story-list">
                  {memoryStories.map(
                    (story) => (
                      <article
                        className="memory-story-card"
                        key={story.id}
                      >
                        {editingStoryId ===
                        story.id ? (
                          <form
                            className="story-edit-form"
                            onSubmit={(event) =>
                              handleEditSubmit(
                                event,
                                story.id,
                              )
                            }
                            aria-busy={
                              updatingStoryId ===
                              story.id
                            }
                          >
                            <label className="form-field">
                              <span>
                                כותרת הסיפור
                              </span>

                              <input
                                type="text"
                                name="title"
                                value={
                                  editForm.title
                                }
                                onChange={
                                  handleEditChange
                                }
                                minLength={2}
                                maxLength={160}
                                required
                              />
                            </label>

                            <label className="form-field">
                              <span>
                                תוכן הסיפור
                              </span>

                              <textarea
                                name="content"
                                value={
                                  editForm.content
                                }
                                onChange={
                                  handleEditChange
                                }
                                minLength={10}
                                maxLength={20000}
                                rows={7}
                                required
                              />
                            </label>

                            <label className="form-field">
                              <span>
                                מתי זה קרה?
                              </span>

                              <input
                                type="date"
                                name="occurredOn"
                                value={
                                  editForm.occurredOn
                                }
                                onChange={
                                  handleEditChange
                                }
                              />
                            </label>

                            <p className="story-edit-notice">
                              לאחר שמירת השינוי
                              הסיפור יחזור למצב
                              טיוטה ויידרש אישור
                              מחדש.
                            </p>

                            <div className="story-edit-actions">
                              <button
                                className="primary-button"
                                type="submit"
                                disabled={
                                  updatingStoryId ===
                                  story.id
                                }
                              >
                                {updatingStoryId ===
                                story.id
                                  ? 'שומרים...'
                                  : 'שמירת השינויים'}
                              </button>

                              <button
                                className="secondary-button"
                                type="button"
                                disabled={
                                  updatingStoryId ===
                                  story.id
                                }
                                onClick={
                                  cancelEditingStory
                                }
                              >
                                ביטול
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="story-card-header">
                              <div>
                                <h3>
                                  {story.title}
                                </h3>

                                <div className="story-dates">
                                  {story.occurredOn && (
                                    <span>
                                      התרחש:{' '}
                                      {formatDateOnly(
                                        story.occurredOn,
                                      )}
                                    </span>
                                  )}

                                  {story.createdAt && (
                                    <span>
                                      נוסף:{' '}
                                      {formatDate(
                                        story.createdAt,
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span
                                className={`story-status story-status-${story.status}`}
                              >
                                {getStoryStatusLabel(
                                  story.status,
                                )}
                              </span>
                            </div>

                            <p className="story-content">
                              {story.content}
                            </p>

                            <div className="story-card-actions">
                              {story.status ===
                                'draft' && (
                                <button
                                  className="story-action-button story-action-approve"
                                  type="button"
                                  disabled={isStoryBusy(
                                    story.id,
                                  )}
                                  onClick={() =>
                                    handleApproveStory(
                                      story.id,
                                    )
                                  }
                                >
                                  {approvingStoryId ===
                                  story.id
                                    ? 'מאשרים...'
                                    : 'אישור הסיפור'}
                                </button>
                              )}

                              <button
                                className="story-action-button story-action-edit"
                                type="button"
                                disabled={isStoryBusy(
                                  story.id,
                                )}
                                onClick={() =>
                                  startEditingStory(
                                    story,
                                  )
                                }
                              >
                                עריכת הסיפור
                              </button>

                              <button
                                className="story-action-button story-action-archive"
                                type="button"
                                disabled={isStoryBusy(
                                  story.id,
                                )}
                                onClick={() =>
                                  handleArchiveStory(
                                    story,
                                  )
                                }
                              >
                                {archivingStoryId ===
                                story.id
                                  ? 'מעבירים...'
                                  : 'העברה לארכיון'}
                              </button>
                            </div>
                          </>
                        )}
                      </article>
                    ),
                  )}
                </div>
              )}
            </div>
          </section>

          <section
            className="profile-features"
            aria-label="אפשרויות עתידיות"
          >
            <article>
              <span aria-hidden="true">
                02
              </span>

              <h2>תמונות והקלטות</h2>

              <p>
                בהמשך יהיה אפשר להוסיף
                תמונות, קול ומסמכים משפחתיים.
              </p>

              <strong>בקרוב</strong>
            </article>

            <article>
              <span aria-hidden="true">
                03
              </span>

              <h2>שיחה אינטראקטיבית</h2>

              <p>
                השיחה תתבסס רק על חומרים
                שנמסרו, נבדקו ואושרו.
              </p>

              <strong>בשלב מתקדם</strong>
            </article>
          </section>
        </section>
      </main>
    )
  }

  export default MemoryProfilePage
