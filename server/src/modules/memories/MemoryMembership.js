import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

export const MEMORY_MEMBER_ROLES =
  Object.freeze([
    'viewer',
    'contributor',
    'editor',
    'steward',
  ])

export const MEMORY_MEMBERSHIP_STATUSES =
  Object.freeze([
    'active',
    'revoked',
  ])

const memoryMembershipSchema = new Schema(
  {
    memoryId: {
      type: Schema.Types.ObjectId,
      ref: 'MemoryProfile',
      required: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    role: {
      type: String,
      enum: MEMORY_MEMBER_ROLES,
      default: 'viewer',
    },

    status: {
      type: String,
      enum: MEMORY_MEMBERSHIP_STATUSES,
      default: 'active',
    },
  },
  {
    collection: 'memory_memberships',
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

        return safeObject
      },
    },
  },
)

memoryMembershipSchema.index(
  {
    memoryId: 1,
    userId: 1,
  },
  {
    unique: true,
    name: 'memory_memberships_memory_user_unique',
  },
)

memoryMembershipSchema.index(
  {
    userId: 1,
    status: 1,
    memoryId: 1,
  },
  {
    name: 'memory_memberships_user_status_memory',
  },
)

const MemoryMembership =
  models.MemoryMembership ??
  model(
    'MemoryMembership',
    memoryMembershipSchema,
  )

export default MemoryMembership