import {
  describe,
  expect,
  it,
} from 'vitest'
import User from '../src/modules/auth/User.js'

function createBaseUser(overrides = {}) {
  return new User({
    displayName: 'Test User',
    email: 'user@example.com',
    ...overrides,
  })
}

describe('Google authentication user fields', () => {
  it('keeps Google subjects private and uniquely indexed', () => {
    expect(
      User.schema.path('googleSubject').options
        .select,
    ).toBe(false)
    expect(
      User.schema.path('googleSubject').options
        .immutable,
    ).toBe(true)

    expect(User.schema.indexes()).toContainEqual([
      {
        googleSubject: 1,
      },
      expect.objectContaining({
        unique: true,
        sparse: true,
        name: 'users_google_subject_unique',
      }),
    ])

    const publicUser = createBaseUser({
      googleSubject: 'google-subject-123',
    }).toJSON()

    expect(publicUser).not.toHaveProperty(
      'googleSubject',
    )
  })

  it('accepts password-only users', async () => {
    const user = createBaseUser({
      passwordHash: 'private-password-hash',
    })

    await expect(user.validate()).resolves.toBeUndefined()
    expect(user.toObject()).not.toHaveProperty(
      'googleSubject',
    )
  })

  it('normalizes an explicit null Google subject to an omitted field', async () => {
    const user = createBaseUser({
      passwordHash: 'private-password-hash',
      googleSubject: null,
    })

    await expect(user.validate()).resolves.toBeUndefined()
    expect(user.googleSubject).toBeUndefined()
    expect(user.toObject()).not.toHaveProperty(
      'googleSubject',
    )
  })

  it('accepts Google-only users', async () => {
    const user = createBaseUser({
      googleSubject: 'google-subject-123',
    })

    await expect(user.validate()).resolves.toBeUndefined()
  })

  it('does not allow an existing Google subject to be replaced on a document', () => {
    const user = User.hydrate({
      displayName: 'Test User',
      email: 'user@example.com',
      googleSubject: 'original-google-subject',
    })

    user.googleSubject = 'replacement-google-subject'

    expect(user.googleSubject).toBe(
      'original-google-subject',
    )
    expect(
      user.isModified('googleSubject'),
    ).toBe(false)
  })

  it('rejects new users without an authentication method', async () => {
    const user = createBaseUser()

    await expect(user.validate()).rejects.toMatchObject({
      name: 'ValidationError',
      errors: {
        passwordHash: expect.objectContaining({
          message:
            'A user must have at least one authentication method.',
        }),
      },
    })
  })

  it('rejects removing every authentication method from an existing fully selected user', async () => {
    const user = User.hydrate({
      displayName: 'Test User',
      email: 'user@example.com',
      passwordHash: 'private-password-hash',
    })

    user.passwordHash = undefined

    await expect(user.validate()).rejects.toMatchObject({
      name: 'ValidationError',
      errors: {
        passwordHash: expect.objectContaining({
          message:
            'A user must have at least one authentication method.',
        }),
      },
    })
  })

  it.each([
    {
      label: 'password',
      update: {
        $unset: {
          passwordHash: 1,
        },
      },
      expectedMessage:
        'A user must have at least one authentication method.',
    },
    {
      label: 'Google subject',
      update: {
        $set: {
          googleSubject: null,
        },
      },
      expectedMessage:
        'An existing Google subject cannot be changed.',
    },
    {
      label: 'both methods',
      update: {
        $unset: {
          passwordHash: 1,
          googleSubject: 1,
        },
      },
      expectedMessage:
        'An existing Google subject cannot be changed.',
    },
  ])('rejects a query update that removes $label without atomically adding another method', async ({ update, expectedMessage }) => {
    await expect(
      User.updateOne(
        {
          email: 'user@example.com',
        },
        update,
      ),
    ).rejects.toThrow(expectedMessage)
  })

  it.each([
    {
      $set: {
        googleSubject: 'replacement-subject',
      },
    },
    {
      $rename: {
        googleSubject: 'legacyGoogleSubject',
      },
    },
    {
      $rename: {
        legacyGoogleSubject: 'googleSubject',
      },
    },
    {
      $setOnInsert: {
        googleSubject: 'replacement-subject',
      },
    },
  ])('rejects query-level Google subject replacement through %#', async (update) => {
    await expect(
      User.updateOne(
        {
          email: 'user@example.com',
        },
        update,
      ),
    ).rejects.toThrow(
      'An existing Google subject cannot be changed.',
    )
  })

  it('rejects replacing an existing user without an authentication method', async () => {
    await expect(
      User.replaceOne(
        {
          email: 'user@example.com',
        },
        {
          displayName: 'Test User',
          email: 'user@example.com',
        },
      ),
    ).rejects.toThrow(
      'User replacement operations are not allowed.',
    )
  })

  it('rejects an update pipeline that touches authentication methods', async () => {
    await expect(
      User.updateOne(
        {
          email: 'user@example.com',
        },
        [
          {
            $unset: 'googleSubject',
          },
        ],
        {
          updatePipeline: true,
        },
      ),
    ).rejects.toThrow(
      'A user must have at least one authentication method.',
    )
  })

  it('rejects rename attempts that could remove a password authentication method', async () => {
    await expect(
      User.updateOne(
        {
          email: 'user@example.com',
        },
        {
          $rename: {
            passwordHash:
              'legacyPasswordHash',
          },
        },
      ),
    ).rejects.toThrow(
      'A user must have at least one authentication method.',
    )
  })

  it.each([
    {
      updateOne: {
        filter: {
          email: 'user@example.com',
        },
        update: {
          $set: {
            googleSubject:
              'replacement-subject',
          },
        },
      },
    },
    {
      replaceOne: {
        filter: {
          email: 'user@example.com',
        },
        replacement: {
          displayName: 'Replacement User',
          email: 'user@example.com',
          passwordHash: 'replacement-hash',
        },
      },
    },
  ])('rejects unsafe authentication changes through bulkWrite', async (operation) => {
    await expect(
      User.bulkWrite([operation]),
    ).rejects.toThrow()
  })
})
