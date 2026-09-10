import { describe, expect, it } from 'vitest'
import GoogleRedirectAttempt from '../src/modules/auth/GoogleRedirectAttempt.js'

describe('Google redirect attempt model', () => {
  it('enforces unique state consumption records and TTL cleanup', () => {
    expect(
      GoogleRedirectAttempt.schema.indexes(),
    ).toEqual(
      expect.arrayContaining([
        [
          {
            stateIdHash: 1,
          },
          expect.objectContaining({
            unique: true,
            name: 'google_redirect_attempt_state_unique',
          }),
        ],
        [
          {
            expiresAt: 1,
          },
          expect.objectContaining({
            expireAfterSeconds: 0,
            name: 'google_redirect_attempt_expiry',
          }),
        ],
      ]),
    )
  })
})
