import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const refreshTokenHashPattern = /^[a-f0-9]{64}$/

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const sessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    refreshTokenHash: {
      type: String,
      required: true,
      select: false,
      match: [
        refreshTokenHashPattern,
        'Refresh token hash is invalid.',
      ],
    },

    familyId: {
      type: String,
      required: true,
      trim: true,
      match: [
        uuidPattern,
        'Session family ID is invalid.',
      ],
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    lastUsedAt: {
      type: Date,
      default: Date.now,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revocationReason: {
      type: String,
      enum: [
        'rotated',
        'logout',
        'reuse_detected',
        'security',
      ],
      default: null,
    },

    replacedBySessionId: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
    },
  },
  {
    collection: 'sessions',
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_document, returnedObject) {
        const safeObject = { ...returnedObject }
        delete safeObject.refreshTokenHash
        return safeObject
      },
    },
  },
)

sessionSchema.index(
  {
    refreshTokenHash: 1,
  },
  {
    unique: true,
    name: 'sessions_refresh_token_hash_unique',
  },
)

sessionSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
    name: 'sessions_expires_at_ttl',
  },
)

sessionSchema.index(
  {
    userId: 1,
    revokedAt: 1,
  },
  {
    name: 'sessions_user_revoked',
  },
)

sessionSchema.index(
  {
    familyId: 1,
    revokedAt: 1,
  },
  {
    name: 'sessions_family_revoked',
  },
)

const Session =
  models.Session ?? model('Session', sessionSchema)

export default Session