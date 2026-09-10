import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const googleRedirectAttemptSchema = new Schema(
  {
    stateIdHash: {
      type: String,
      required: true,
      select: false,
      match: /^[a-f0-9]{64}$/,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    collection: 'google_redirect_attempts',
    timestamps: false,
    versionKey: false,
  },
)

googleRedirectAttemptSchema.index(
  {
    stateIdHash: 1,
  },
  {
    unique: true,
    name: 'google_redirect_attempt_state_unique',
  },
)

googleRedirectAttemptSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
    name: 'google_redirect_attempt_expiry',
  },
)

const GoogleRedirectAttempt =
  models.GoogleRedirectAttempt ??
  model(
    'GoogleRedirectAttempt',
    googleRedirectAttemptSchema,
  )

export default GoogleRedirectAttempt
