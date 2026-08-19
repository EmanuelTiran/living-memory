import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  generateClonedSpeechAudio,
} from '../src/modules/voice/elevenLabsSpeechProvider.js'

const voiceId =
  'testVoiceId1234567890'

function createHeaders(contentType) {
  return {
    get(name) {
      return name.toLowerCase() ===
        'content-type'
        ? contentType
        : null
    },
  }
}

function createAudioResponse({
  bytes = [
    0x49,
    0x44,
    0x33,
    0x04,
    0x00,
    0x00,
  ],
  contentType = 'audio/mpeg',
} = {}) {
  return {
    ok: true,
    status: 200,
    headers:
      createHeaders(contentType),
    async arrayBuffer() {
      return Uint8Array.from(bytes)
        .buffer
    },
  }
}

function createConfiguration(
  fetchImplementation,
) {
  return {
    fetchImplementation,
    apiKey: 'test-elevenlabs-key',
    model: 'eleven_v3',
    timeoutMs: 20000,
    maxAudioBytes: 1024 * 1024,
  }
}

describe(
  'ElevenLabs speech provider',
  () => {
    it('generates Hebrew MP3 with automatic language detection and no reference-audio upload', async () => {
      const fetchImplementation =
        vi.fn().mockResolvedValue(
          createAudioResponse(),
        )

      const result =
        await generateClonedSpeechAudio(
          {
            text:
              'ברוכים הבאים לזיכרון חי.',
            voiceId,
          },
          createConfiguration(
            fetchImplementation,
          ),
        )

      expect(
        fetchImplementation,
      ).toHaveBeenCalledTimes(1)

      const [endpoint, request] =
        fetchImplementation.mock.calls[0]

      expect(endpoint).toBe(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      )

      expect(request.method).toBe('POST')
      expect(request.headers).toMatchObject({
        'xi-api-key':
          'test-elevenlabs-key',
        'Content-Type':
          'application/json',
        Accept: 'audio/mpeg',
      })

      const body = JSON.parse(
        request.body,
      )

      expect(body).toEqual({
        text:
          'ברוכים הבאים לזיכרון חי.',
        model_id: 'eleven_v3',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
          speed: 1,
        },
      })

      expect(body).not.toHaveProperty(
        'language_code',
      )
      expect(body).not.toHaveProperty(
        'reference_audio',
      )

      expect(result).toMatchObject({
        contentType: 'audio/mpeg',
        fileExtension: 'mp3',
        provider: 'elevenlabs',
        model: 'eleven_v3',
        voiceType: 'custom_clone',
        isAiGenerated: true,
      })
    })

    it('returns a safe billing error when ElevenLabs has no available credit', async () => {
      const fetchImplementation =
        vi.fn().mockResolvedValue({
          ok: false,
          status: 402,
        })

      await expect(
        generateClonedSpeechAudio(
          {
            text: 'שלום עולם',
            voiceId,
          },
          createConfiguration(
            fetchImplementation,
          ),
        ),
      ).rejects.toMatchObject({
        statusCode: 402,
        code:
          'VOICE_CLONE_BILLING_REQUIRED',
      })
    })

    it('returns a safe authentication error for a rejected API key', async () => {
      const fetchImplementation =
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
        })

      await expect(
        generateClonedSpeechAudio(
          {
            text: 'שלום עולם',
            voiceId,
          },
          createConfiguration(
            fetchImplementation,
          ),
        ),
      ).rejects.toMatchObject({
        statusCode: 503,
        code:
          'VOICE_CLONE_AUTHENTICATION_FAILED',
      })
    })

    it('rejects malformed or non-MP3 output', async () => {
      const fetchImplementation =
        vi.fn().mockResolvedValue(
          createAudioResponse({
            bytes: [
              0x6e,
              0x6f,
              0x74,
              0x2d,
              0x6d,
              0x70,
              0x33,
            ],
          }),
        )

      await expect(
        generateClonedSpeechAudio(
          {
            text: 'שלום עולם',
            voiceId,
          },
          createConfiguration(
            fetchImplementation,
          ),
        ),
      ).rejects.toMatchObject({
        statusCode: 502,
        code:
          'VOICE_CLONE_INVALID_RESPONSE',
      })
    })
  },
)
