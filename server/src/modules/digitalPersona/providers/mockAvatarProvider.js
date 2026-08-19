import { randomUUID } from 'node:crypto'
import { createAvatarProvider } from './AvatarProvider.js'

export const mockAvatarProvider =
  createAvatarProvider({
    name: 'mock',

    async createProfile() {
      return {
        providerProfileId:
          `mock-avatar-${randomUUID()}`,
        profileType: 'stylized',
        status: 'ready',
        isPhotorealistic: false,
        disclosure:
          'זהו אווטאר בדיקה מסוגנן. הוא אינו חיקוי פוטוריאליסטי של האדם.',
      }
    },

    async disableProfile() {
      return {
        disabled: true,
      }
    },
  })
