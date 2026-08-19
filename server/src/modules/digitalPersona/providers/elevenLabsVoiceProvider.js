import { createVoiceProvider } from './VoiceProvider.js'

export const elevenLabsVoiceProvider =
  createVoiceProvider({
    name: 'elevenlabs',

    async createProfile({ voiceId }) {
      if (
        typeof voiceId !== 'string' ||
        !/^[A-Za-z0-9_-]{10,100}$/.test(
          voiceId,
        )
      ) {
        throw new TypeError(
          'A valid ElevenLabs voice ID is required.',
        )
      }

      return {
        providerProfileId: voiceId,
        profileType: 'custom',
        status: 'ready',
        languageCode: 'he',
        isRealVoiceClone: true,
        disclosure:
          'זהו קול AI שנוצר משכפול הקול שאושר על ידיכם. הוא אינו אמירה חדשה או בזמן אמת של האדם.',
      }
    },

    async disableProfile() {
      return {
        disabled: true,
      }
    },
  })
