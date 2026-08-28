import mongoose from 'mongoose'
import {
  MEMORY_MEMBER_ROLES,
} from './MemoryMembership.js'

const { Schema, model, models } = mongoose

export const MEMORY_INVITATION_STATUSES =
  Object.freeze([
    'pending',
    'accepted',
    'revoked',
    'expired',
  ])

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const memoryInvitationSchema = new Schema(
  {
    memoryId: {
      type: Schema.Types.ObjectId,
      ref: 'MemoryProfile',
      required: true,
      immutable: true,
    },

    invitedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },

    invitedEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: [
        emailPattern,
        'Invitation email format is invalid.',
      ],
      immutable: true,
    },

    role: {
      type: String,
      enum: MEMORY_MEMBER_ROLES,
      required: true,
      immutable: true,
    },

    tokenHash: {
      type: String,
      trim: true,
      minlength: 64,
      maxlength: 64,
      match: [
        /^[0-9a-f]{64}$/,
        'Invitation token hash is invalid.',
      ],
      select: false,
    },

    status: {
      type: String,
      enum: MEMORY_INVITATION_STATUSES,
      default: 'pending',
    },

    expiresAt: {
      type: Date,
      required: true,
      immutable: true,
    },

    acceptedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    acceptedAt: {
      type: Date,
      default: null,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    expiredAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'memory_invitations',
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_document, returnedObject) {
        const safeObject = {
          ...returnedObject,
        }

        if (safeObject._id) {
          safeObject.id =
            safeObject._id.toString()

          delete safeObject._id
        }

        delete safeObject.tokenHash
        delete safeObject.acceptedByUserId

        return safeObject
      },
    },
  },
)

memoryInvitationSchema.pre(
  'validate',
  function validateInvitationState() {
    if (
      this.status === 'pending' &&
      !this.tokenHash
    ) {
      this.invalidate(
        'tokenHash',
        'Pending invitations require a token hash.',
      )
    }

    if (
      this.status === 'accepted' &&
      (!this.acceptedByUserId ||
        !this.acceptedAt)
    ) {
      this.invalidate(
        'acceptedAt',
        'Accepted invitations require an accepting user and timestamp.',
      )
    }

    if (
      this.status === 'revoked' &&
      !this.revokedAt
    ) {
      this.invalidate(
        'revokedAt',
        'Revoked invitations require a revocation timestamp.',
      )
    }

    if (
      this.status === 'expired' &&
      !this.expiredAt
    ) {
      this.invalidate(
        'expiredAt',
        'Expired invitations require an expiration timestamp.',
      )
    }
  },
)

memoryInvitationSchema.index(
  {
    tokenHash: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      tokenHash: {
        $type: 'string',
      },
    },
    name: 'memory_invitations_token_hash_unique',
  },
)

memoryInvitationSchema.index(
  {
    memoryId: 1,
    invitedEmail: 1,
    status: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      status: 'pending',
    },
    name: 'memory_invitations_one_pending_email',
  },
)

memoryInvitationSchema.index(
  {
    memoryId: 1,
    createdAt: -1,
  },
  {
    name: 'memory_invitations_memory_created',
  },
)

const MemoryInvitation =
  models.MemoryInvitation ??
  model(
    'MemoryInvitation',
    memoryInvitationSchema,
  )

export default MemoryInvitation
