import {
  describe,
  expect,
  it,
} from 'vitest'
import { createMemoryAssetAccessTokenService } from '../src/modules/media/memoryAssetAccessToken.js'

const memoryId =
  '507f1f77bcf86cd799439010'

const assetId =
  '507f1f77bcf86cd799439011'

describe(
  'Memory asset access tokens',
  () => {
    it(
      'creates a short-lived grant bound to one memory, asset, and disposition',
      () => {
        const now = Date.parse(
          '2026-08-24T08:00:00.000Z',
        )

        const service =
          createMemoryAssetAccessTokenService({
            secret: 's'.repeat(64),
            now: () => now,
            generateNonce: () =>
              'fixedNonceValue_12345',
          })

        const grant = service.sign({
          memoryId,
          assetId,
          disposition: 'inline',
        })

        expect(grant.expiresAt).toBe(
          '2026-08-24T08:02:00.000Z',
        )

        expect(
          service.verify({
            token: grant.token,
            memoryId,
            assetId,
          }),
        ).toEqual({
          disposition: 'inline',
          expiresAt:
            '2026-08-24T08:02:00.000Z',
        })

        expect(
          service.verify({
            token: grant.token,
            memoryId:
              '507f1f77bcf86cd799439099',
            assetId,
          }),
        ).toBeNull()
      },
    )

    it(
      'rejects tampered and expired grants',
      () => {
        let now = Date.parse(
          '2026-08-24T08:00:00.000Z',
        )

        const service =
          createMemoryAssetAccessTokenService({
            secret: 't'.repeat(64),
            now: () => now,
            generateNonce: () =>
              'anotherNonceValue_123',
          })

        const grant = service.sign({
          memoryId,
          assetId,
          disposition: 'attachment',
        })

        const tamperedToken =
          `${grant.token.slice(0, -1)}${
            grant.token.endsWith('a')
              ? 'b'
              : 'a'
          }`

        expect(
          service.verify({
            token: tamperedToken,
            memoryId,
            assetId,
          }),
        ).toBeNull()

        now += 121_000

        expect(
          service.verify({
            token: grant.token,
            memoryId,
            assetId,
          }),
        ).toBeNull()
      },
    )
  },
)
