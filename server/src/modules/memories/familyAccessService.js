import {
  createHash,
  randomBytes,
} from 'node:crypto'
import { AppError } from '../../errors/AppError.js'
import User from '../auth/User.js'
import MemoryInvitation from './MemoryInvitation.js'
import MemoryMembership from './MemoryMembership.js'
import MemoryParticipationConsent, {
  MEMORY_PARTICIPATION_POLICY_VERSION,
} from './MemoryParticipationConsent.js'
import MemoryProfile from './MemoryProfile.js'
import {
  MEMORY_PERMISSIONS,
  requireMemoryPermission,
} from './memoryAccessService.js'
import {
  acceptMemoryInvitationSchema,
  createMemoryInvitationSchema,
  previewMemoryInvitationSchema,
  updateMemoryMembershipSchema,
} from './familyAccessValidation.js'

const INVITATION_LIFETIME_MS =
  14 * 24 * 60 * 60 * 1000

function validateIdentifier(name, value) {
  if (
    typeof value !== 'string' ||
    value.length === 0
  ) {
    throw new TypeError(
      `${name} must be a non-empty string.`,
    )
  }
}

function createInvitationUnavailableError() {
  return new AppError(
    'Memory invitation was not found or is no longer available.',
    {
      statusCode: 404,
      code: 'MEMORY_INVITATION_UNAVAILABLE',
    },
  )
}

function createInvitationConflictError(code) {
  const messages = {
    MEMORY_INVITATION_ALREADY_PENDING:
      'A pending invitation already exists for this email.',
    MEMORY_MEMBER_ALREADY_ACTIVE:
      'This account already has access to the memory.',
    MEMORY_OWNER_CANNOT_BE_INVITED:
      'The memory owner cannot be invited as a member.',
  }

  return new AppError(
    messages[code] ??
      'The invitation could not be created.',
    {
      statusCode: 409,
      code,
    },
  )
}

function createRoleManagementError() {
  return new AppError(
    'Only the memory owner can manage steward access.',
    {
      statusCode: 403,
      code: 'MEMORY_STEWARD_MANAGEMENT_FORBIDDEN',
    },
  )
}

function hashInvitationToken(token) {
  return createHash('sha256')
    .update(token)
    .digest('hex')
}

function maskEmail(email) {
  const [localPart, domain] =
    email.split('@')

  const visiblePrefix =
    localPart.slice(0, 2)

  return `${visiblePrefix}${'*'.repeat(
    Math.max(localPart.length - 2, 2),
  )}@${domain}`
}

function createInvitationPublicObject(
  invitation,
) {
  return {
    id: invitation._id.toString(),
    invitedEmail: invitation.invitedEmail,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
    revokedAt: invitation.revokedAt,
    expiredAt: invitation.expiredAt,
    createdAt: invitation.createdAt,
  }
}

function createMemberPublicObject(
  membership,
  user,
) {
  return {
    membershipId:
      membership._id.toString(),
    displayName:
      user?.displayName ?? 'משתמש משפחתי',
    email: user?.email ?? '',
    role: membership.role,
    status: membership.status,
    joinedAt: membership.createdAt,
  }
}

function assertManagerCanAssignRole(
  managerRole,
  role,
) {
  if (
    role === 'steward' &&
    managerRole !== 'owner'
  ) {
    throw createRoleManagementError()
  }
}

function assertManagerCanChangeMember(
  managerRole,
  managerUserId,
  membership,
  nextRole,
) {
  if (managerRole === 'owner') {
    return
  }

  if (
    membership.role === 'steward' ||
    membership.userId.toString() ===
      managerUserId ||
    nextRole === 'steward'
  ) {
    throw createRoleManagementError()
  }
}

async function expirePendingInvitations(
  filter,
  now,
) {
  await MemoryInvitation.updateMany(
    {
      ...filter,
      status: 'pending',
      expiresAt: {
        $lte: now,
      },
    },
    {
      $set: {
        status: 'expired',
        expiredAt: now,
      },
      $unset: {
        tokenHash: 1,
      },
    },
  )
}

async function findInvitationByToken(token) {
  return MemoryInvitation.findOne({
    tokenHash:
      hashInvitationToken(token),
  }).select('+tokenHash')
}

export async function createMemoryInvitation(
  userId,
  memoryId,
  input,
  now = new Date(),
) {
  validateIdentifier('User ID', userId)
  validateIdentifier('Memory ID', memoryId)

  const invitationData =
    createMemoryInvitationSchema.parse(input)

  const access =
    await requireMemoryPermission(
      userId,
      memoryId,
      MEMORY_PERMISSIONS.MANAGE,
    )

  assertManagerCanAssignRole(
    access.authorization.role,
    invitationData.role,
  )

  await expirePendingInvitations(
    {
      memoryId,
      invitedEmail: invitationData.email,
    },
    now,
  )

  const invitedUser = await User.findOne({
    email: invitationData.email,
  }).select('_id')

  if (
    invitedUser &&
    invitedUser._id.toString() ===
      access.memoryProfile.ownerId.toString()
  ) {
    throw createInvitationConflictError(
      'MEMORY_OWNER_CANNOT_BE_INVITED',
    )
  }

  if (invitedUser) {
    const activeMembership =
      await MemoryMembership.exists({
        memoryId,
        userId: invitedUser._id,
        status: 'active',
      })

    if (activeMembership) {
      throw createInvitationConflictError(
        'MEMORY_MEMBER_ALREADY_ACTIVE',
      )
    }
  }

  const pendingInvitation =
    await MemoryInvitation.exists({
      memoryId,
      invitedEmail: invitationData.email,
      status: 'pending',
    })

  if (pendingInvitation) {
    throw createInvitationConflictError(
      'MEMORY_INVITATION_ALREADY_PENDING',
    )
  }

  const token = randomBytes(32)
    .toString('base64url')

  try {
    const invitation =
      await MemoryInvitation.create({
        memoryId,
        invitedByUserId: userId,
        invitedEmail: invitationData.email,
        role: invitationData.role,
        tokenHash:
          hashInvitationToken(token),
        expiresAt: new Date(
          now.getTime() +
            INVITATION_LIFETIME_MS,
        ),
      })

    return {
      invitation:
        createInvitationPublicObject(
          invitation,
        ),
      token,
    }
  } catch (error) {
    if (error?.code === 11000) {
      throw createInvitationConflictError(
        'MEMORY_INVITATION_ALREADY_PENDING',
      )
    }

    throw error
  }
}

export async function getMemoryFamilyAccess(
  userId,
  memoryId,
  now = new Date(),
) {
  validateIdentifier('User ID', userId)
  validateIdentifier('Memory ID', memoryId)

  const access =
    await requireMemoryPermission(
      userId,
      memoryId,
      MEMORY_PERMISSIONS.MANAGE,
    )

  await expirePendingInvitations(
    {
      memoryId,
    },
    now,
  )

  const [memberships, invitations] =
    await Promise.all([
      MemoryMembership.find({
        memoryId,
      }).sort({ createdAt: 1 }),
      MemoryInvitation.find({
        memoryId,
      }).sort({ createdAt: -1 }),
    ])

  const userIds = [
    access.memoryProfile.ownerId,
    ...memberships.map(
      (membership) => membership.userId,
    ),
  ]

  const users = await User.find({
    _id: {
      $in: userIds,
    },
  })
    .select('displayName email status')
    .lean()

  const usersById = new Map(
    users.map((user) => [
      user._id.toString(),
      user,
    ]),
  )

  const owner = usersById.get(
    access.memoryProfile.ownerId.toString(),
  )

  return {
    memoryProfile: {
      id:
        access.memoryProfile._id.toString(),
      subjectName:
        access.memoryProfile.subjectName,
    },
    authorization:
      access.authorization,
    members: [
      {
        membershipId: null,
        displayName:
          owner?.displayName ??
          'בעל או בעלת הארכיון',
        email: owner?.email ?? '',
        role: 'owner',
        status: 'active',
        joinedAt:
          access.memoryProfile.createdAt,
      },
      ...memberships.map((membership) =>
        createMemberPublicObject(
          membership,
          usersById.get(
            membership.userId.toString(),
          ),
        ),
      ),
    ],
    invitations: invitations.map(
      createInvitationPublicObject,
    ),
  }
}

export async function listSharedMemoryProfiles(
  userId,
) {
  validateIdentifier('User ID', userId)

  const memberships =
    await MemoryMembership.find({
      userId,
      status: 'active',
    }).select('memoryId role')

  if (memberships.length === 0) {
    return []
  }

  const profiles = await MemoryProfile.find({
    _id: {
      $in: memberships.map(
        (membership) =>
          membership.memoryId,
      ),
    },
    visibility: 'shared',
    status: 'active',
  }).sort({ createdAt: -1 })

  const rolesByMemoryId = new Map(
    memberships.map((membership) => [
      membership.memoryId.toString(),
      membership.role,
    ]),
  )

  return profiles.map((profile) => ({
    ...profile.toJSON(),
    authorization: {
      accessType: 'membership',
      role: rolesByMemoryId.get(
        profile._id.toString(),
      ),
    },
  }))
}

export async function getAccessibleMemoryProfile(
  userId,
  memoryId,
) {
  const access =
    await requireMemoryPermission(
      userId,
      memoryId,
      MEMORY_PERMISSIONS.VIEW,
    )

  return {
    ...access.memoryProfile.toJSON(),
    authorization:
      access.authorization,
  }
}

export async function previewMemoryInvitation(
  input,
  now = new Date(),
) {
  const { token } =
    previewMemoryInvitationSchema.parse(input)

  const invitation =
    await findInvitationByToken(token)

  if (!invitation) {
    throw createInvitationUnavailableError()
  }

  if (
    invitation.status === 'pending' &&
    invitation.expiresAt <= now
  ) {
    await expirePendingInvitations(
      {
        _id: invitation._id,
      },
      now,
    )

    throw createInvitationUnavailableError()
  }

  if (invitation.status !== 'pending') {
    throw createInvitationUnavailableError()
  }

  const memoryProfile =
    await MemoryProfile.findOne({
      _id: invitation.memoryId,
      status: 'active',
    }).select('subjectName')

  if (!memoryProfile) {
    throw createInvitationUnavailableError()
  }

  return {
    subjectName: memoryProfile.subjectName,
    role: invitation.role,
    invitedEmailHint:
      maskEmail(invitation.invitedEmail),
    expiresAt: invitation.expiresAt,
    consentPolicyVersion:
      MEMORY_PARTICIPATION_POLICY_VERSION,
  }
}

export async function acceptMemoryInvitation(
  userId,
  input,
  now = new Date(),
) {
  validateIdentifier('User ID', userId)

  const acceptanceData =
    acceptMemoryInvitationSchema.parse(input)

  const user = await User.findOne({
    _id: userId,
    status: 'active',
  }).select('email')

  if (!user) {
    throw createInvitationUnavailableError()
  }

  let invitation =
    await findInvitationByToken(
      acceptanceData.token,
    )

  if (!invitation) {
    throw createInvitationUnavailableError()
  }

  if (
    invitation.status === 'pending' &&
    invitation.expiresAt <= now
  ) {
    await expirePendingInvitations(
      {
        _id: invitation._id,
      },
      now,
    )

    throw createInvitationUnavailableError()
  }

  if (
    invitation.invitedEmail !==
    user.email.toLowerCase()
  ) {
    throw new AppError(
      'The invitation belongs to a different account email.',
      {
        statusCode: 403,
        code: 'MEMORY_INVITATION_EMAIL_MISMATCH',
      },
    )
  }

  if (invitation.status === 'pending') {
    invitation =
      await MemoryInvitation.findOneAndUpdate(
        {
          _id: invitation._id,
          status: 'pending',
          tokenHash:
            hashInvitationToken(
              acceptanceData.token,
            ),
          expiresAt: {
            $gt: now,
          },
        },
        {
          $set: {
            status: 'accepted',
            acceptedByUserId: userId,
            acceptedAt: now,
          },
        },
        {
          returnDocument: 'after',
        },
      )
  }

  if (
    !invitation ||
    invitation.status !== 'accepted' ||
    invitation.acceptedByUserId
      ?.toString() !== userId
  ) {
    throw createInvitationUnavailableError()
  }

  await MemoryParticipationConsent.updateOne(
    {
      invitationId: invitation._id,
    },
    {
      $setOnInsert: {
        memoryId: invitation.memoryId,
        userId,
        invitationId: invitation._id,
        role: invitation.role,
        policyVersion:
          acceptanceData.consent
            .policyVersion,
        attestations: {
          acceptsArchiveParticipation:
            acceptanceData.consent
              .acceptsArchiveParticipation,
          acceptsRecordingAndTranscription:
            acceptanceData.consent
              .acceptsRecordingAndTranscription,
          understandsGroundedAiUse:
            acceptanceData.consent
              .understandsGroundedAiUse,
        },
        acceptedAt: now,
      },
    },
    {
      upsert: true,
    },
  )

  const membership =
    await MemoryMembership.findOneAndUpdate(
      {
        memoryId: invitation.memoryId,
        userId,
      },
      {
        $set: {
          role: invitation.role,
          status: 'active',
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
        runValidators: true,
      },
    )

  const memoryProfile =
    await MemoryProfile.findOneAndUpdate(
      {
        _id: invitation.memoryId,
        status: 'active',
      },
      {
        $set: {
          visibility: 'shared',
        },
      },
      {
        returnDocument: 'after',
      },
    )

  if (!memoryProfile) {
    throw createInvitationUnavailableError()
  }

  await MemoryInvitation.updateOne(
    {
      _id: invitation._id,
      acceptedByUserId: userId,
    },
    {
      $unset: {
        tokenHash: 1,
      },
    },
  )

  return {
    memoryProfile: {
      ...memoryProfile.toJSON(),
      authorization: {
        accessType: 'membership',
        role: membership.role,
      },
    },
    consent: {
      policyVersion:
        acceptanceData.consent
          .policyVersion,
      acceptedAt: now,
    },
  }
}

export async function revokeMemoryInvitation(
  userId,
  memoryId,
  invitationId,
  now = new Date(),
) {
  const access =
    await requireMemoryPermission(
      userId,
      memoryId,
      MEMORY_PERMISSIONS.MANAGE,
    )

  const invitation =
    await MemoryInvitation.findOne({
      _id: invitationId,
      memoryId,
      status: 'pending',
    })

  if (!invitation) {
    throw createInvitationUnavailableError()
  }

  assertManagerCanAssignRole(
    access.authorization.role,
    invitation.role,
  )

  const revokedInvitation =
    await MemoryInvitation.findOneAndUpdate(
      {
        _id: invitation._id,
        memoryId,
        status: 'pending',
      },
      {
        $set: {
          status: 'revoked',
          revokedAt: now,
        },
        $unset: {
          tokenHash: 1,
        },
      },
      {
        returnDocument: 'after',
      },
    )

  if (!revokedInvitation) {
    throw createInvitationUnavailableError()
  }

  return createInvitationPublicObject(
    revokedInvitation,
  )
}

export async function updateMemoryMemberRole(
  userId,
  memoryId,
  membershipId,
  input,
) {
  const roleData =
    updateMemoryMembershipSchema.parse(input)

  const access =
    await requireMemoryPermission(
      userId,
      memoryId,
      MEMORY_PERMISSIONS.MANAGE,
    )

  const membership =
    await MemoryMembership.findOne({
      _id: membershipId,
      memoryId,
      status: 'active',
    })

  if (!membership) {
    throw new AppError(
      'Memory member was not found.',
      {
        statusCode: 404,
        code: 'MEMORY_MEMBER_NOT_FOUND',
      },
    )
  }

  assertManagerCanChangeMember(
    access.authorization.role,
    userId,
    membership,
    roleData.role,
  )

  membership.role = roleData.role
  await membership.save()

  const memberUser = await User.findById(
    membership.userId,
  )
    .select('displayName email status')
    .lean()

  return createMemberPublicObject(
    membership,
    memberUser,
  )
}

export async function revokeMemoryMember(
  userId,
  memoryId,
  membershipId,
) {
  const access =
    await requireMemoryPermission(
      userId,
      memoryId,
      MEMORY_PERMISSIONS.MANAGE,
    )

  const membership =
    await MemoryMembership.findOne({
      _id: membershipId,
      memoryId,
      status: 'active',
    })

  if (!membership) {
    throw new AppError(
      'Memory member was not found.',
      {
        statusCode: 404,
        code: 'MEMORY_MEMBER_NOT_FOUND',
      },
    )
  }

  assertManagerCanChangeMember(
    access.authorization.role,
    userId,
    membership,
  )

  membership.status = 'revoked'
  await membership.save()

  return createMemberPublicObject(
    membership,
    null,
  )
}
