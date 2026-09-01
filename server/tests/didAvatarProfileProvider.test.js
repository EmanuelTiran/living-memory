import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  didAvatarProfileProvider,
} from '../src/modules/digitalPersona/providers/didAvatarProfileProvider.js'

describe('D-ID avatar profile source', () => {
  it('binds the avatar profile to the memory portrait asset', async () => {
    const portraitAssetId =
      '507f1f77bcf86cd799439011'

    await expect(
      didAvatarProfileProvider.createProfile({
        assetId: portraitAssetId,
      }),
    ).resolves.toMatchObject({
      providerProfileId:
        portraitAssetId,
      profileType: 'stylized',
      status: 'ready',
    })
  })

  it('rejects a hard-coded or invalid avatar identifier', async () => {
    await expect(
      didAvatarProfileProvider.createProfile({
        assetId:
          'emanuel-living-memory-avatar-v1',
      }),
    ).rejects.toThrow(
      'An approved memory portrait asset is required.',
    )
  })
})
