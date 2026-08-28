import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

vi.mock('../src/config/env.js', () => ({
  env: {
    pilotAvatarEnabled: false,
  },
}))

import {
  requirePilotAvatarFeature,
} from '../src/middleware/requirePilotAvatarFeature.js'

describe('Private-pilot avatar guard', () => {
  it('returns a not-found error while the avatar is disabled', () => {
    const next = vi.fn()

    requirePilotAvatarFeature(
      {},
      {},
      next,
    )

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        code: 'PILOT_AVATAR_DISABLED',
      }),
    )
  })
})
