import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const passwordResetTokenHashPattern =
  /^[a-f0-9]{64}$/

const userSchema = new Schema(
  {
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: [
        emailPattern,
        'Email format is invalid.',
      ],
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    passwordResetTokenHash: {
      type: String,
      select: false,
      match: [
        passwordResetTokenHashPattern,
        'Password reset token hash is invalid.',
      ],
    },

    passwordResetExpiresAt: {
      type: Date,
      select: false,
    },

    systemRole: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },

    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
  },
  {
    collection: 'users',
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

        delete safeObject.passwordHash
        delete safeObject.passwordResetTokenHash
        delete safeObject.passwordResetExpiresAt

        return safeObject
      },
    },
  },
)

userSchema.index(
  {
    email: 1,
  },
  {
    unique: true,
    name: 'users_email_unique',
  },
)

userSchema.index(
  {
    passwordResetTokenHash: 1,
    passwordResetExpiresAt: 1,
  },
  {
    sparse: true,
    name: 'users_password_reset_token',
  },
)

const User =
  models.User ?? model('User', userSchema)

export default User
