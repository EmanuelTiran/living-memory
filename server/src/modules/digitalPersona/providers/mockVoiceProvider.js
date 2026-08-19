import { randomUUID } from 'node:crypto'
import { createVoiceProvider } from './VoiceProvider.js'

export const mockVoiceProvider =
  createVoiceProvider({
    name: 'mock',

    async createProfile() {
      return {
        providerProfileId:
          `mock-voice-${randomUUID()}`,
        profileType: 'mock',
        status: 'ready',
        languageCode: 'he',
        isRealVoiceClone: false,
        disclosure:
          'זהו פרופיל בדיקה מלאכותי. הוא אינו שיבוט קול ואינו קולו של האדם.',
      }
    },

    async disableProfile() {
      return {
        disabled: true,
      }
    },
  })
