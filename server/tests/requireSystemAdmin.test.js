import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  userExists: vi.fn(),
}))

vi.mock(
  '../src/modules/auth/User.js',
  () => ({
    default: {
      exists: mocks.userExists,
    },
  }),
)

import { requireSystemAdmin } from '../src/middleware/requireSystemAdmin.js'

const userId = '507f1f77bcf86cd799439010'

function createRequest(systemRole = 'admin') {
  return {
    auth: {
      userId,
      systemRole,
    },
  }
}

describe('System administrator middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows an administrator who is still active in the database', async () => {
    mocks.userExists.mockResolvedValue({
      _id: userId,
    })

    const next = vi.fn()

    await requireSystemAdmin(
      createRequest(),
      {},
      next,
    )

    expect(mocks.userExists)
      .toHaveBeenCalledWith({
        _id: userId,
        systemRole: 'admin',
        status: 'active',
      })
    expect(next).toHaveBeenCalledWith()
  })

  it('rejects a non-admin token without querying the database', async () => {
    const next = vi.fn()

    await requireSystemAdmin(
      createRequest('user'),
      {},
      next,
    )

    expect(mocks.userExists)
      .not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        code: 'ADMIN_ACCESS_REQUIRED',
      }),
    )
  })

  it('rejects an administrator whose live role or status changed', async () => {
    mocks.userExists.mockResolvedValue(null)
    const next = vi.fn()

    await requireSystemAdmin(
      createRequest(),
      {},
      next,
    )

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        code: 'ADMIN_ACCESS_REQUIRED',
      }),
    )
  })

  it('forwards database failures to the error handler', async () => {
    const databaseError = new Error(
      'database unavailable',
    )
    mocks.userExists.mockRejectedValue(
      databaseError,
    )
    const next = vi.fn()

    await requireSystemAdmin(
      createRequest(),
      {},
      next,
    )

    expect(next).toHaveBeenCalledWith(
      databaseError,
    )
  })
})
