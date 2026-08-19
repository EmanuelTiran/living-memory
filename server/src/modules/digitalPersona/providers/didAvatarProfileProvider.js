import { createAvatarProvider } from './AvatarProvider.js'

export const DID_AVATAR_ASSET_ID =
  'emanuel-living-memory-avatar-v1'

export const didAvatarProfileProvider =
  createAvatarProvider({
    name: 'd-id',

    async createProfile({ assetId }) {
      if (
        assetId !== DID_AVATAR_ASSET_ID
      ) {
        throw new TypeError(
          'The approved D-ID avatar asset is required.',
        )
      }

      return {
        providerProfileId: assetId,
        profileType: 'stylized',
        status: 'ready',
        isPhotorealistic: false,
        disclosure:
          'זהו אווטאר AI מסוגנן שנוצר מתמונה שאושרה. תנועת הפנים והשפתיים מלאכותית ואינה צילום בזמן אמת.',
      }
    },

    async disableProfile() {
      return {
        disabled: true,
      }
    },
  })
