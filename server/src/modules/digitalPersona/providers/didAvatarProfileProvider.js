import { createAvatarProvider } from './AvatarProvider.js'

const objectIdPattern =
  /^[0-9a-f]{24}$/i

export const didAvatarProfileProvider =
  createAvatarProvider({
    name: 'd-id',

    async createProfile({ assetId }) {
      if (
        typeof assetId !== 'string' ||
        !objectIdPattern.test(assetId)
      ) {
        throw new TypeError(
          'An approved memory portrait asset is required.',
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
