import mongoose from 'mongoose'

const { Schema, model, models } = mongoose

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const passwordResetTokenHashPattern =
  /^[a-f0-9]{64}$/
const authenticationMethodErrorMessage =
  'A user must have at least one authentication method.'

function hasOwn(object, field) {
  return Object.prototype.hasOwnProperty.call(
    object ?? {},
    field,
  )
}

function updateRemovesField(update, field) {
  return (
    (hasOwn(update, field) && !update[field]) ||
    hasOwn(update?.$unset, field) ||
    (hasOwn(update?.$set, field) &&
      !update.$set[field])
  )
}

function renameTouchesField(update, field) {
  return (
    hasOwn(update?.$rename, field) ||
    Object.values(update?.$rename ?? {}).includes(
      field,
    )
  )
}

function updateTouchesField(update, field) {
  if (hasOwn(update, field)) {
    return true
  }

  return Object.entries(update ?? {}).some(
    ([operator, value]) => {
      if (!operator.startsWith('$')) {
        return false
      }

      if (hasOwn(value, field)) {
        return true
      }

      return (
        operator === '$rename' &&
        Object.values(value ?? {}).includes(field)
      )
    },
  )
}

function updateSetsField(update, field) {
  return (
    hasOwn(update?.$set, field) &&
    typeof update.$set[field] === 'string' &&
    update.$set[field].length > 0
  )
}

function pipelineTouchesAuthenticationMethod(
  value,
) {
  if (Array.isArray(value)) {
    return value.some(
      pipelineTouchesAuthenticationMethod,
    )
  }

  if (
    typeof value === 'string'
  ) {
    return [
      'passwordHash',
      'googleSubject',
      '$passwordHash',
      '$googleSubject',
    ].includes(value)
  }

  if (!value || typeof value !== 'object') {
    return false
  }

  return Object.entries(value).some(
    ([field, nestedValue]) =>
      field === 'passwordHash' ||
      field === 'googleSubject' ||
      pipelineTouchesAuthenticationMethod(
        nestedValue,
      ),
  )
}

function assertSafeAuthenticationMethodUpdate(update) {
  if (!update) {
    return
  }

  if (Array.isArray(update)) {
    if (
      pipelineTouchesAuthenticationMethod(update)
    ) {
      throw new Error(
        authenticationMethodErrorMessage,
      )
    }

    return
  }

  if (updateTouchesField(update, 'googleSubject')) {
    throw new Error(
      'An existing Google subject cannot be changed.',
    )
  }

  if (renameTouchesField(update, 'passwordHash')) {
    throw new Error(authenticationMethodErrorMessage)
  }

  const removesPassword = updateRemovesField(
    update,
    'passwordHash',
  )
  const removesGoogle = updateRemovesField(
    update,
    'googleSubject',
  )

  if (
    (removesPassword &&
      !updateSetsField(update, 'googleSubject')) ||
    (removesGoogle &&
      !updateSetsField(update, 'passwordHash'))
  ) {
    throw new Error(authenticationMethodErrorMessage)
  }
}

function rejectUnsafeAuthenticationMethodUpdate() {
  assertSafeAuthenticationMethodUpdate(
    this.getUpdate(),
  )
}

function rejectAuthenticationMethodReplacement() {
  throw new Error(
    'User replacement operations are not allowed.',
  )
}

function rejectUnsafeAuthenticationBulkWrite(
  operations,
) {
  for (const operation of operations) {
    const update =
      operation?.updateOne?.update ??
      operation?.updateMany?.update

    if (update) {
      assertSafeAuthenticationMethodUpdate(update)
    }

    if (operation?.replaceOne) {
      rejectAuthenticationMethodReplacement()
    }
  }
}

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
      select: false,
    },

    googleSubject: {
      type: String,
      select: false,
      immutable: true,
      set: (value) =>
        value === null ? undefined : value,
      minlength: 1,
      maxlength: 255,
      match: [
        /^[A-Za-z0-9_-]+$/,
        'Google subject is invalid.',
      ],
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
        delete safeObject.googleSubject
        delete safeObject.passwordResetTokenHash
        delete safeObject.passwordResetExpiresAt

        return safeObject
      },
    },
  },
)

userSchema.pre('validate', function ensureAuthenticationMethod() {
  const authenticationFieldsAreSelected =
    this.isNew ||
    (this.isSelected('passwordHash') &&
      this.isSelected('googleSubject'))

  if (
    authenticationFieldsAreSelected &&
    !this.passwordHash &&
    !this.googleSubject
  ) {
    this.invalidate(
      'passwordHash',
      authenticationMethodErrorMessage,
    )
  }
})

userSchema.pre(
  ['findOneAndUpdate', 'updateMany', 'updateOne'],
  rejectUnsafeAuthenticationMethodUpdate,
)

userSchema.pre(
  ['findOneAndReplace', 'replaceOne'],
  rejectAuthenticationMethodReplacement,
)

userSchema.pre(
  'bulkWrite',
  rejectUnsafeAuthenticationBulkWrite,
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

userSchema.index(
  {
    googleSubject: 1,
  },
  {
    unique: true,
    sparse: true,
    name: 'users_google_subject_unique',
  },
)

const User =
  models.User ?? model('User', userSchema)

export default User
