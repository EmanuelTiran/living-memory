import {
  useCallback,
  useEffect,
  useId,
  useRef,
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
  createMemoryInvitation,
  getMemoryFamilyAccess,
  revokeMemoryInvitation,
  revokeMemoryMember,
  updateMemoryMemberRole,
} from '../../api/familyAccessApi.js'
import './FamilyAccessPage.css'

const roleOptions = [
  {
    value: 'viewer',
    label: 'צפייה ושאלות',
    summary: 'צפייה בארכיון ושאלת שאלות בלבד',
    tooltip:
      'מאפשר צפייה בארכיון ושאלת שאלות על החומרים המאושרים. ללא הוספת תוכן, עריכה או ניהול הרשאות.',
  },
  {
    value: 'contributor',
    label: 'מספר/ת ותיעוד',
    summary: 'הוספת סיפורים, זיכרונות והקלטות',
    tooltip:
      'כולל צפייה ושאלות, ובנוסף אפשרות להוסיף סיפורים, זיכרונות, תשובות והקלטות לארכיון. ללא עריכת חומרים קיימים או ניהול גישה.',
  },
  {
    value: 'editor',
    label: 'עריכת הארכיון',
    summary: 'עריכה, ארגון ושיפור חומרים קיימים',
    tooltip:
      'כולל צפייה, שאלות ותיעוד, ובנוסף עריכת חומרים קיימים, ארגון ושיפור תוכן הארכיון. ללא ניהול בני משפחה והרשאות.',
  },
  {
    value: 'steward',
    label: 'נאמן/ת משפחתי/ת',
    summary: 'ניהול גישה, הזמנות ותפקידי בני משפחה',
    tooltip:
      'מתאים למי שמסייע/ת בניהול הארכיון המשפחתי בפועל. כולל צפייה, שאלות, תיעוד ועריכה, וגם הזמנת בני משפחה, עדכון תפקידים וניהול הגישה לארכיון. מינוי או ניהול של נאמן/ת משפחתי/ת נוסף/ת שמור לבעל/ת הארכיון.',
  },
]

const roleLabels = {
  owner: 'בעלים',
  ...Object.fromEntries(
    roleOptions.map((option) => [
      option.value,
      option.label,
    ]),
  ),
}

const invitationStatusLabels = {
  pending: 'ממתינה לקבלה',
  accepted: 'התקבלה',
  revoked: 'בוטלה',
  expired: 'פג תוקפה',
}

function formatDate(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'לא ידוע'
  }

  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'medium',
  }).format(date)
}

function getFamilyAccessErrorMessage(error) {
  if (!(error instanceof ApiError)) {
    return 'אירעה שגיאה בלתי צפויה.'
  }

  const messages = {
    MEMORY_NOT_FOUND:
      'הארכיון לא נמצא או שאין לך הרשאה לנהל אותו.',
    MEMORY_INVITATION_ALREADY_PENDING:
      'כבר קיימת הזמנה פעילה לכתובת הזאת.',
    MEMORY_MEMBER_ALREADY_ACTIVE:
      'לחשבון הזה כבר יש גישה לארכיון.',
    MEMORY_OWNER_CANNOT_BE_INVITED:
      'בעל הארכיון כבר מחזיק בגישה מלאה.',
    MEMORY_STEWARD_MANAGEMENT_FORBIDDEN:
      'רק בעל הארכיון יכול לנהל נאמנים משפחתיים.',
    VALIDATION_ERROR:
      'בדקו את כתובת האימייל ואת התפקיד שבחרתם.',
    NETWORK_ERROR:
      'לא הצלחנו להתחבר לשרת.',
  }

  return (
    messages[error.code] ??
    'לא הצלחנו להשלים את הפעולה.'
  )
}

function createMemberRoleMap(familyAccess) {
  return Object.fromEntries(
    familyAccess.members
      .filter(
        (member) => member.membershipId,
      )
      .map((member) => [
        member.membershipId,
        member.role,
      ]),
  )
}

function RoleSelector({
  value,
  onChange,
  canAssignSteward,
  ariaLabel,
}) {
  const [isOpen, setIsOpen] =
    useState(false)
  const selectorRef = useRef(null)
  const triggerRef = useRef(null)
  const listboxId = useId()
  const availableOptions = canAssignSteward
    ? roleOptions
    : roleOptions.filter(
        (option) =>
          option.value !== 'steward',
      )
  const selectedOption =
    roleOptions.find(
      (option) => option.value === value,
    ) ?? availableOptions[0]

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    function handlePointerDown(event) {
      if (
        !selectorRef.current?.contains(
          event.target,
        )
      ) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener(
      'pointerdown',
      handlePointerDown,
    )
    document.addEventListener(
      'keydown',
      handleKeyDown,
    )

    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDown,
      )
      document.removeEventListener(
        'keydown',
        handleKeyDown,
      )
    }
  }, [isOpen])

  function handleSelect(nextValue) {
    onChange(nextValue)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div
      className={`role-selector ${
        isOpen ? 'role-selector-open' : ''
      }`}
      ref={selectorRef}
    >
      <button
        className="role-selector-trigger"
        type="button"
        ref={triggerRef}
        aria-label={`${ariaLabel}: ${selectedOption.label}`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        onClick={() => {
          setIsOpen((current) => !current)
        }}
      >
        <span>{selectedOption.label}</span>
        <span
          className="role-selector-chevron"
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          className="role-selector-panel"
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
        >
          {availableOptions.map((option) => {
            const isSelected =
              option.value === value

            return (
              <button
                className="role-selector-option"
                type="button"
                role="option"
                aria-selected={isSelected}
                data-aura-tooltip={option.tooltip}
                key={option.value}
                onClick={() => {
                  handleSelect(option.value)
                }}
              >
                <span
                  className="role-selector-check"
                  aria-hidden="true"
                >
                  {isSelected ? '✓' : ''}
                </span>
                <span className="role-selector-copy">
                  <strong>{option.label}</strong>
                  <small>{option.summary}</small>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FamilyAccessPage({
  authentication,
  onAuthenticationChange,
}) {
  const { memoryId } = useParams()
  const navigate = useNavigate()

  const [familyAccess, setFamilyAccess] =
    useState(null)
  const [email, setEmail] = useState('')
  const [role, setRole] =
    useState('contributor')
  const [memberRoles, setMemberRoles] =
    useState({})
  const [invitationLink, setInvitationLink] =
    useState('')
  const [isLoading, setIsLoading] =
    useState(true)
  const [busyKey, setBusyKey] =
    useState('')
  const [errorMessage, setErrorMessage] =
    useState('')
  const [successMessage, setSuccessMessage] =
    useState('')
  const [deliveryWarning, setDeliveryWarning] =
    useState('')
  const [isInvitationOpen, setIsInvitationOpen] =
    useState(false)
  const [editingMemberId, setEditingMemberId] =
    useState('')
  const [isPendingOpen, setIsPendingOpen] =
    useState(null)

  const runAuthenticatedRequest =
    useCallback(
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

            return operation(
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

  const loadFamilyAccess = useCallback(
    async () => {
      const result =
        await runAuthenticatedRequest(
          (accessToken) =>
            getMemoryFamilyAccess(
              accessToken,
              memoryId,
            ),
        )

      setFamilyAccess(result)
      setMemberRoles(
        createMemberRoleMap(result),
      )
    },
    [memoryId, runAuthenticatedRequest],
  )

  useEffect(() => {
    let isActive = true

    runAuthenticatedRequest(
      (accessToken) =>
        getMemoryFamilyAccess(
          accessToken,
          memoryId,
        ),
    )
      .then((result) => {
        if (isActive) {
          setFamilyAccess(result)
          setMemberRoles(
            createMemberRoleMap(result),
          )
        }
      })
      .catch((error) => {
        if (isActive) {
          setErrorMessage(
            getFamilyAccessErrorMessage(
              error,
            ),
          )
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [memoryId, runAuthenticatedRequest])

  async function handleCreateInvitation(
    event,
  ) {
    event.preventDefault()
    const submittedEmail = email
      .trim()
      .toLowerCase()

    setBusyKey('create')
    setErrorMessage('')
    setSuccessMessage('')
    setDeliveryWarning('')
    setInvitationLink('')

    try {
      const result =
        await runAuthenticatedRequest(
          (accessToken) =>
            createMemoryInvitation(
              accessToken,
              memoryId,
              {
                email,
                role,
              },
            ),
        )

      const invitedEmail =
        result.invitation?.invitedEmail ??
        submittedEmail

      setInvitationLink(
        result.invitationUrl,
      )
      setEmail('')

      if (result.emailDelivery === 'sent') {
        setSuccessMessage(
          `ההזמנה נשלחה ל־${invitedEmail}. הקישור זמין גם כאן להעתקה.`,
        )
      } else {
        setDeliveryWarning(
          'ההזמנה נוצרה, אבל שליחת המייל לא הצליחה. אפשר להעתיק את הקישור ולשלוח אותו ידנית.',
        )
      }

      await loadFamilyAccess()
    } catch (error) {
      setErrorMessage(
        getFamilyAccessErrorMessage(error),
      )
    } finally {
      setBusyKey('')
    }
  }

  async function handleCopyInvitation() {
    try {
      await navigator.clipboard.writeText(
        invitationLink,
      )
      setSuccessMessage(
        'קישור ההזמנה הועתק.',
      )
    } catch {
      setErrorMessage(
        'לא הצלחנו להעתיק אוטומטית. סמנו את הקישור והעתיקו אותו ידנית.',
      )
    }
  }

  async function handleRevokeInvitation(
    invitationId,
  ) {
    setBusyKey(`invitation-${invitationId}`)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      await runAuthenticatedRequest(
        (accessToken) =>
          revokeMemoryInvitation(
            accessToken,
            memoryId,
            invitationId,
          ),
      )
      setSuccessMessage('ההזמנה בוטלה.')
      await loadFamilyAccess()
    } catch (error) {
      setErrorMessage(
        getFamilyAccessErrorMessage(error),
      )
    } finally {
      setBusyKey('')
    }
  }

  async function handleUpdateMember(member) {
    const nextRole =
      memberRoles[member.membershipId]

    setBusyKey(`member-${member.membershipId}`)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      await runAuthenticatedRequest(
        (accessToken) =>
          updateMemoryMemberRole(
            accessToken,
            memoryId,
            member.membershipId,
            nextRole,
          ),
      )
      setSuccessMessage(
        'התפקיד המשפחתי עודכן.',
      )
      setEditingMemberId('')
      await loadFamilyAccess()
    } catch (error) {
      setErrorMessage(
        getFamilyAccessErrorMessage(error),
      )
    } finally {
      setBusyKey('')
    }
  }

  async function handleRevokeMember(member) {
    if (
      !window.confirm(
        `לבטל את הגישה של ${member.displayName}?`,
      )
    ) {
      return
    }

    setBusyKey(`member-${member.membershipId}`)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      await runAuthenticatedRequest(
        (accessToken) =>
          revokeMemoryMember(
            accessToken,
            memoryId,
            member.membershipId,
          ),
      )
      setSuccessMessage(
        'הגישה המשפחתית בוטלה.',
      )
      setEditingMemberId('')
      await loadFamilyAccess()
    } catch (error) {
      setErrorMessage(
        getFamilyAccessErrorMessage(error),
      )
    } finally {
      setBusyKey('')
    }
  }

  const managerRole =
    familyAccess?.authorization?.role
  const canAssignSteward =
    managerRole === 'owner'
  const members =
    familyAccess?.members ?? []
  const activeMemberCount =
    members.filter(
      (member) => member.status !== 'revoked',
    ).length
  const pendingInvitations =
    familyAccess?.invitations.filter(
      (invitation) =>
        invitation.status === 'pending',
    ) ?? []
  const invitationHistory =
    familyAccess?.invitations.filter(
      (invitation) =>
        invitation.status !== 'pending',
    ) ?? []

  return (
    <main className="page-shell">
      <section
        className="surface-card family-access-page"
        aria-labelledby="family-access-title"
      >
        <div className="family-access-toolbar">
          <Link
            className="back-link"
            data-aura-tooltip="לחזור לפרופיל הזיכרון"
            to={
              memoryId
                ? `/app/memories/${memoryId}`
                : '/app'
            }
          >
            חזרה לארכיון
          </Link>
        </div>

        <header className="family-access-profile-hero">
          <div className="family-access-profile-hero-top">
            <div className="family-access-hero-copy">
              <p className="family-access-private">
                <span aria-hidden="true" />
                גישה משפחתית
              </p>
              <p className="family-access-kicker">
                המעגל המשפחתי
              </p>
              <h1 id="family-access-title">
                המשפחה
              </h1>
              <p className="family-access-hero-support">
                ניהול בני המשפחה, ההזמנות והגישה
                לזיכרון
              </p>
            </div>

            <div
              className="family-access-ornament"
              aria-hidden="true"
            >
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="family-access-hero-lower">
            <p>
              המעגל שסביב הזיכרון של{' '}
              <strong>
                {familyAccess?.memoryProfile
                  .subjectName ?? 'המשפחה'}
              </strong>
            </p>

            {familyAccess && (
              <dl className="family-access-summary">
                <div>
                  <dt>בני משפחה פעילים</dt>
                  <dd>{activeMemberCount}</dd>
                </div>
                <div>
                  <dt>הזמנות ממתינות</dt>
                  <dd>{pendingInvitations.length}</dd>
                </div>
              </dl>
            )}
          </div>
        </header>

        {errorMessage && (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        )}

        {successMessage && (
          <p className="form-notice" role="status">
            {successMessage}
          </p>
        )}

        {deliveryWarning && (
          <p
            className="family-access-delivery-warning"
            role="status"
          >
            {deliveryWarning}
          </p>
        )}

        {isLoading ? (
          <div
            className="family-access-loading"
            aria-live="polite"
          >
            <span
              className="loading-indicator"
              aria-hidden="true"
            />
            <p>טוענים את המעגל המשפחתי...</p>
          </div>
        ) : familyAccess ? (
          <div className="family-access-content">
            <section className="family-invite-region">
              <button
                className="primary-button family-invite-toggle"
                type="button"
                aria-expanded={isInvitationOpen}
                aria-controls="family-invitation-panel"
                data-aura-tooltip="לפתוח הזמנה חדשה למעגל המשפחתי"
                onClick={() => {
                  setIsInvitationOpen(
                    (current) => !current,
                  )
                }}
              >
                <span aria-hidden="true">+</span>
                הזמנת בן משפחה
              </button>

              {isInvitationOpen && (
                <div
                  className="family-invitation-panel"
                  id="family-invitation-panel"
                >
                  <div className="family-section-heading">
                    <p className="panel-kicker">
                      הזמנה חדשה
                    </p>
                    <h2>
                      מצרפים למעגל של{' '}
                      {
                        familyAccess.memoryProfile
                          .subjectName
                      }
                    </h2>
                    <p>
                      ההזמנה אישית, חד־פעמית
                      ותקפה ל־14 ימים.
                    </p>
                  </div>

                  <form
                    className="family-invitation-form"
                    onSubmit={
                      handleCreateInvitation
                    }
                  >
                    <label className="form-field">
                      <span>כתובת האימייל המוזמנת</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value)
                        }}
                        maxLength={254}
                        autoComplete="email"
                        dir="ltr"
                        required
                      />
                    </label>

                    <div className="form-field">
                      <span>תפקיד משפחתי</span>
                      <RoleSelector
                        value={role}
                        onChange={(nextRole) => {
                          setRole(nextRole)
                        }}
                        canAssignSteward={
                          canAssignSteward
                        }
                        ariaLabel="תפקיד משפחתי להזמנה החדשה"
                      />
                    </div>

                    <button
                      className="primary-button"
                      type="submit"
                      data-aura-tooltip="לשלוח הזמנה אישית לבן או לבת המשפחה"
                      disabled={
                        busyKey === 'create'
                      }
                    >
                      {busyKey === 'create'
                        ? 'שולחים הזמנה...'
                        : 'שליחת הזמנה'}
                    </button>
                  </form>

                  {invitationLink && (
                    <div className="invitation-link-box">
                      <strong>
                        הקישור מוצג פעם אחת בלבד
                      </strong>
                      <p>
                        אל תפרסמו אותו בקבוצה
                        פתוחה. רק החשבון בעל
                        כתובת האימייל שהוזמנה
                        יוכל לקבל אותו.
                      </p>
                      <div>
                        <input
                          type="text"
                          value={invitationLink}
                          readOnly
                          dir="ltr"
                          aria-label="קישור ההזמנה"
                        />
                        <button
                          className="secondary-button"
                          type="button"
                          data-aura-tooltip="להעתיק את קישור ההזמנה"
                          onClick={
                            handleCopyInvitation
                          }
                        >
                          העתקת הקישור
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section
              className="family-access-section family-members-section"
              aria-labelledby="family-members-title"
            >
              <div className="family-section-heading family-section-heading-row">
                <div>
                  <p className="panel-kicker">
                    חברי הארכיון
                  </p>
                  <h2 id="family-members-title">
                    בני המשפחה במעגל
                  </h2>
                </div>
                <span className="family-section-count">
                  {activeMemberCount} פעילים
                </span>
              </div>

              <div className="family-member-list">
                {members.map((member) => {
                  const isOwner =
                    member.role === 'owner'
                  const isRevoked =
                    member.status === 'revoked'
                  const isProtectedSteward =
                    managerRole !== 'owner' &&
                    member.role === 'steward'
                  const canManage =
                    !isOwner &&
                    !isRevoked &&
                    !isProtectedSteward
                  const isEditing =
                    editingMemberId ===
                    member.membershipId

                  return (
                    <article
                      className={`family-member-card ${
                        isRevoked
                          ? 'family-member-card-revoked'
                          : ''
                      } ${
                        isEditing
                          ? 'family-member-card-editing'
                          : ''
                      }`}
                      key={
                        member.membershipId ??
                        'owner'
                      }
                    >
                      <div className="family-member-identity">
                        <span
                          className="family-member-initial"
                          aria-hidden="true"
                        >
                          {member.displayName
                            .trim()
                            .charAt(0)}
                        </span>
                        <div>
                          <h3>
                            {member.displayName}
                          </h3>
                          <p dir="ltr">
                            {member.email}
                          </p>
                        </div>
                      </div>

                      <div className="family-member-status">
                        <span className="family-member-role-badge">
                          {isRevoked
                            ? 'הגישה בוטלה'
                            : roleLabels[
                                member.role
                              ]}
                        </span>
                        {isOwner && (
                          <span className="family-owner-badge">
                            בעל/ת הארכיון
                          </span>
                        )}
                      </div>

                      {canManage && (
                        <details className="family-member-menu">
                          <summary
                            aria-label={`פעולות עבור ${member.displayName}`}
                            data-aura-tooltip="לפתוח פעולות עבור בן המשפחה"
                          >
                            <span aria-hidden="true">
                              ⋮
                            </span>
                          </summary>
                          <div className="family-member-menu-actions">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.currentTarget
                                  .closest('details')
                                  ?.removeAttribute(
                                    'open',
                                  )
                                setMemberRoles(
                                  (current) => ({
                                    ...current,
                                    [member.membershipId]:
                                      member.role,
                                  }),
                                )
                                setEditingMemberId(
                                  member.membershipId,
                                )
                              }}
                            >
                              שינוי תפקיד
                            </button>
                            <button
                              className="family-member-menu-danger"
                              type="button"
                              onClick={() =>
                                handleRevokeMember(
                                  member,
                                )
                              }
                              disabled={
                                busyKey ===
                                `member-${member.membershipId}`
                              }
                            >
                              ביטול גישה
                            </button>
                          </div>
                        </details>
                      )}

                      {canManage && isEditing && (
                        <div className="member-role-editor">
                          <div className="member-role-editor-heading">
                            <strong>
                              שינוי התפקיד של{' '}
                              {member.displayName}
                            </strong>
                            <span>
                              בחרו את רמת הגישה
                              המתאימה למעגל המשפחתי.
                            </span>
                          </div>
                          <div className="member-role-editor-controls">
                            <RoleSelector
                              value={
                                memberRoles[
                                  member.membershipId
                                ] ?? member.role
                              }
                              onChange={(nextRole) => {
                                setMemberRoles(
                                  (current) => ({
                                    ...current,
                                    [member.membershipId]:
                                      nextRole,
                                  }),
                                )
                              }}
                              canAssignSteward={
                                canAssignSteward
                              }
                              ariaLabel={`תפקיד עבור ${member.displayName}`}
                            />
                            <button
                              className="primary-button"
                              type="button"
                              data-aura-tooltip="לשמור את התפקיד החדש"
                              onClick={() =>
                                handleUpdateMember(
                                  member,
                                )
                              }
                              disabled={
                                busyKey ===
                                `member-${member.membershipId}`
                              }
                            >
                              עדכון תפקיד
                            </button>
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => {
                                setMemberRoles(
                                  (current) => ({
                                    ...current,
                                    [member.membershipId]:
                                      member.role,
                                  }),
                                )
                                setEditingMemberId('')
                              }}
                              disabled={
                                busyKey ===
                                `member-${member.membershipId}`
                              }
                            >
                              ביטול
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>

            <details
              className="family-access-disclosure"
              open={
                isPendingOpen ??
                pendingInvitations.length > 0
              }
              onToggle={(event) => {
                setIsPendingOpen(
                  event.currentTarget.open,
                )
              }}
            >
              <summary>
                <span>הזמנות ממתינות</span>
                <span className="family-disclosure-count">
                  {pendingInvitations.length}
                </span>
                <span
                  className="family-disclosure-chevron"
                  aria-hidden="true"
                />
              </summary>
              <div className="family-disclosure-content">
                {pendingInvitations.length === 0 ? (
                  <p className="family-empty-note">
                    אין כרגע הזמנות שממתינות
                    לקבלה.
                  </p>
                ) : (
                  <div className="family-invitation-list">
                    {pendingInvitations.map(
                      (invitation) => (
                        <article
                          className="family-invitation-card"
                          key={invitation.id}
                        >
                          <div>
                            <h3 dir="ltr">
                              {invitation.invitedEmail}
                            </h3>
                            <p>
                              {
                                roleLabels[
                                  invitation.role
                                ]
                              }
                            </p>
                            <small>
                              בתוקף עד{' '}
                              {formatDate(
                                invitation.expiresAt,
                              )}
                            </small>
                          </div>
                          <button
                            className="danger-button"
                            type="button"
                            data-aura-tooltip="לבטל את קישור ההזמנה"
                            onClick={() =>
                              handleRevokeInvitation(
                                invitation.id,
                              )
                            }
                            disabled={
                              busyKey ===
                              `invitation-${invitation.id}`
                            }
                          >
                            ביטול ההזמנה
                          </button>
                        </article>
                      ),
                    )}
                  </div>
                )}
              </div>
            </details>

            <details className="family-access-disclosure">
              <summary>
                <span>היסטוריית הזמנות</span>
                <span className="family-disclosure-count">
                  {invitationHistory.length}
                </span>
                <span
                  className="family-disclosure-chevron"
                  aria-hidden="true"
                />
              </summary>
              <div className="family-disclosure-content">
                {invitationHistory.length === 0 ? (
                  <p className="family-empty-note">
                    עדיין אין הזמנות שהושלמו,
                    בוטלו או שפג תוקפן.
                  </p>
                ) : (
                  <div className="family-invitation-list">
                    {invitationHistory.map(
                      (invitation) => (
                        <article
                          className="family-invitation-card family-invitation-card-history"
                          key={invitation.id}
                        >
                          <div>
                            <h3 dir="ltr">
                              {invitation.invitedEmail}
                            </h3>
                            <p>
                              {
                                roleLabels[
                                  invitation.role
                                ]
                              }{' '}
                              ·{' '}
                              {
                                invitationStatusLabels[
                                  invitation.status
                                ]
                              }
                            </p>
                            <small>
                              נוצרה{' '}
                              {formatDate(
                                invitation.createdAt,
                              )}
                            </small>
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                )}
              </div>
            </details>
          </div>
        ) : null}
      </section>
    </main>
  )
}

export default FamilyAccessPage
