import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  findVoiceProfile: vi.fn(),
  findConsent: vi.fn(),
  generateClonedSpeechAudio:
    vi.fn(),
}))

function createLeanQuery(result) {
  const query = {
    select: vi.fn(),
    lean: vi.fn(),
  }

  query.select.mockReturnValue(query)
  query.lean.mockResolvedValue(result)

  return query
}

vi.mock(
  '../src/modules/digitalPersona/VoiceProfile.js',
  () => ({
    default: {
      findOne:
        mocks.findVoiceProfile,
    },
  }),
)

vi.mock(
  '../src/modules/digitalPersona/ConsentRecord.js',
  () => ({
    default: {
      findOne: mocks.findConsent,
    },
  }),
)

vi.mock(
  '../src/modules/voice/elevenLabsSpeechProvider.js',
  () => ({
    ELEVENLABS_TEXT_MAX_LENGTH:
      2000,
    isClonedVoiceProviderConfigured:
      () => true,
    generateClonedSpeechAudio:
      mocks.generateClonedSpeechAudio,
  }),
)

import {
  tryGenerateClonedSpeech,
} from '../src/modules/voice/voiceCloneSpeechService.js'

const memoryId =
  '507f1f77bcf86cd799439011'

const voiceId =
  'testVoiceId1234567890'

beforeEach(() => {
  vi.resetAllMocks()

  mocks.findVoiceProfile
    .mockReturnValue(
      createLeanQuery(null),
    )
})

describe(
  'Voice clone speech service',
  () => {
    it('does not contact ElevenLabs when no approved clone is active', async () => {
      const result =
        await tryGenerateClonedSpeech({
          memoryId,
          text: 'שלום עולם',
        })

      expect(result).toBeNull()
      expect(
        mocks.findConsent,
      ).not.toHaveBeenCalled()
      expect(
        mocks.generateClonedSpeechAudio,
      ).not.toHaveBeenCalled()
    })

    it('sends only the original UTF-8 text to the matching consented ElevenLabs voice', async () => {
      mocks.findVoiceProfile
        .mockReturnValue(
          createLeanQuery({
            consentRecordId:
              'consent-id',
            providerProfileId:
              voiceId,
          }),
        )

      mocks.findConsent
        .mockReturnValue(
          createLeanQuery({
            externalVoiceConsent: {
              provider:
                'elevenlabs',
              providerVoiceId:
                voiceId,
            },
          }),
        )

      mocks.generateClonedSpeechAudio
        .mockResolvedValue({
          provider: 'elevenlabs',
        })

      const result =
        await tryGenerateClonedSpeech({
          memoryId,
          text: 'שלום עולם',
        })

      expect(result).toEqual({
        provider: 'elevenlabs',
      })

      expect(
        mocks.findConsent,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          'externalVoiceConsent.provider':
            'elevenlabs',
          'externalVoiceConsent.modelFamily':
            'eleven_v3',
          'externalVoiceConsent.textProcessor':
            'none',
          'externalVoiceConsent.providerVoiceId':
            voiceId,
        }),
      )

      expect(
        mocks.generateClonedSpeechAudio,
      ).toHaveBeenCalledWith({
        text: 'שלום עולם',
        voiceId,
      })
    })

    it('rejects long clone text before contacting ElevenLabs', async () => {
      mocks.findVoiceProfile
        .mockReturnValue(
          createLeanQuery({
            consentRecordId:
              'consent-id',
            providerProfileId:
              voiceId,
          }),
        )

      await expect(
        tryGenerateClonedSpeech({
          memoryId,
          text: 'א'.repeat(2001),
        }),
      ).rejects.toMatchObject({
        statusCode: 422,
        code:
          'VOICE_CLONE_TEXT_TOO_LONG',
      })

      expect(
        mocks.findConsent,
      ).not.toHaveBeenCalled()
      expect(
        mocks.generateClonedSpeechAudio,
      ).not.toHaveBeenCalled()
    })
  },
)
