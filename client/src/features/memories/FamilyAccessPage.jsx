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
  createMemoryInvitation,
  getMemoryFamilyAccess,
  revokeMemoryInvitation,
  revokeMemoryMember,
  updateMemoryMemberRole,
} from '../../api/familyAccessApi.js'
import './FamilyAccessPage.css'

const roleLabels = {
  owner: 'בעלים',
  viewer: 'צפייה ושאלות',
  contributor: 'מספר/ת ותיעוד',
  editor: 'עריכת הארכיון',
  steward: 'נאמן/ת משפחתי/ת',
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
    setBusyKey('create')
    setErrorMessage('')
    setSuccessMessage('')
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

      const nextLink =
        `${window.location.origin}` +
        `/invitation#token=${encodeURIComponent(
          result.token,
        )}`

      setInvitationLink(nextLink)
      setEmail('')
      setSuccessMessage(
        'ההזמנה נוצרה. העתיקו את הקישור ושלחו אותו רק לבן או לבת המשפחה שאליהם הוא מיועד.',
      )
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

  return (
    <main className="page-shell">
      <section
        className="surface-card family-access-page"
        aria-labelledby="family-access-title"
      >
        <Link
          className="back-link"
          to={
            memoryId
              ? `/app/memories/${memoryId}`
              : '/app'
          }
        >
          חזרה לארכיון
        </Link>

        <header className="family-access-header">
          <p className="eyebrow">
            המעגל המשפחתי
          </p>
          <h1 id="family-access-title">
            הזמנות והרשאות
          </h1>
          <p>
            לכל בן משפחה יש חשבון ותפקיד
            משלו. קישור ההזמנה הוא אישי,
            חד־פעמי ותקף ל־14 ימים.
          </p>
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
          <>
            <section className="family-access-section">
              <div>
                <p className="panel-kicker">
                  הזמנה חדשה
                </p>
                <h2>
                  הזמנת בן או בת משפחה אל
                  הזיכרון של{' '}
                  {
                    familyAccess.memoryProfile
                      .subjectName
                  }
                </h2>
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

                <label className="form-field">
                  <span>תפקיד משפחתי</span>
                  <select
                    value={role}
                    onChange={(event) => {
                      setRole(event.target.value)
                    }}
                  >
                    <option value="viewer">
                      {roleLabels.viewer}
                    </option>
                    <option value="contributor">
                      {roleLabels.contributor}
                    </option>
                    <option value="editor">
                      {roleLabels.editor}
                    </option>
                    {canAssignSteward && (
                      <option value="steward">
                        {roleLabels.steward}
                      </option>
                    )}
                  </select>
                </label>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={busyKey === 'create'}
                >
                  {busyKey === 'create'
                    ? 'יוצרים הזמנה...'
                    : 'יצירת קישור הזמנה'}
                </button>
              </form>

              {invitationLink && (
                <div className="invitation-link-box">
                  <strong>
                    הקישור מוצג פעם אחת בלבד
                  </strong>
                  <p>
                    אל תפרסמו אותו בקבוצה פתוחה.
                    רק החשבון בעל כתובת האימייל
                    שהוזמנה יוכל לקבל אותו.
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
                      onClick={
                        handleCopyInvitation
                      }
                    >
                      העתקת הקישור
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="family-access-section">
              <div>
                <p className="panel-kicker">
                  חברי הארכיון
                </p>
                <h2>מי מחזיק בגישה פעילה?</h2>
              </div>

              <div className="family-member-list">
                {familyAccess.members.map(
                  (member) => {
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

                    return (
                      <article
                        className="family-member-card"
                        key={
                          member.membershipId ??
                          'owner'
                        }
                      >
                        <div>
                          <h3>
                            {member.displayName}
                          </h3>
                          <p dir="ltr">
                            {member.email}
                          </p>
                          <span>
                            {isRevoked
                              ? 'הגישה בוטלה'
                              : roleLabels[
                                  member.role
                                ]}
                          </span>
                        </div>

                        {canManage && (
                          <div className="member-actions">
                            <select
                              value={
                                memberRoles[
                                  member
                                    .membershipId
                                ] ?? member.role
                              }
                              onChange={(event) => {
                                setMemberRoles(
                                  (current) => ({
                                    ...current,
                                    [member.membershipId]:
                                      event.target
                                        .value,
                                  }),
                                )
                              }}
                              aria-label={`תפקיד עבור ${member.displayName}`}
                            >
                              <option value="viewer">
                                {roleLabels.viewer}
                              </option>
                              <option value="contributor">
                                {
                                  roleLabels.contributor
                                }
                              </option>
                              <option value="editor">
                                {roleLabels.editor}
                              </option>
                              {canAssignSteward && (
                                <option value="steward">
                                  {
                                    roleLabels.steward
                                  }
                                </option>
                              )}
                            </select>
                            <button
                              className="secondary-button"
                              type="button"
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
                              className="danger-button"
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
                        )}
                      </article>
                    )
                  },
                )}
              </div>
            </section>

            <section className="family-access-section">
              <div>
                <p className="panel-kicker">
                  היסטוריית הזמנות
                </p>
                <h2>קישורים שנוצרו</h2>
              </div>

              {familyAccess.invitations.length ===
              0 ? (
                <p className="family-empty-note">
                  עדיין לא נוצרו הזמנות.
                </p>
              ) : (
                <div className="family-invitation-list">
                  {familyAccess.invitations.map(
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
                            {roleLabels[
                              invitation.role
                            ]}{' '}
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
                            {invitation.status ===
                              'pending' &&
                              ` · בתוקף עד ${formatDate(
                                invitation.expiresAt,
                              )}`}
                          </small>
                        </div>

                        {invitation.status ===
                          'pending' && (
                          <button
                            className="danger-button"
                            type="button"
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
                        )}
                      </article>
                    ),
                  )}
                </div>
              )}
            </section>
          </>
        ) : null}
      </section>
    </main>
  )
}

export default FamilyAccessPage
