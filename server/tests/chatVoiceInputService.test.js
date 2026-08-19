import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  requireMemoryPermission: vi.fn(),
  findConsent: vi.fn(),
  leanConsent: vi.fn(),
}))

vi.mock(
  '../src/config/env.js',
  () => ({
    env: {
      openaiApiKey:
        'test-openai-key',
      openaiTranscriptionModel:
        'gpt-transcribe',
    },
  }),
)

vi.mock(
  '../src/modules/memories/memoryAccessService.js',
  () => ({
    MEMORY_PERMISSIONS: {
      MANAGE: 'manage',
    },
    requireMemoryPermission:
      mocks.requireMemoryPermission,
  }),
)

vi.mock(
  '../src/modules/digitalPersona/ConsentRecord.js',
  () => ({
    EXTERNAL_TRANSCRIPTION_CONSENT_POLICY_VERSION:
      'openai-hebrew-chat-transcription-v1',
    default: {
      findOne(query) {
        mocks.findConsent(query)

        return {
          select() {
            return {
              lean:
                mocks.leanConsent,
            }
          },
        }
      },
    },
  }),
)

vi.mock(
  '../src/modules/media/openaiTranscriptionProvider.js',
  () => ({
    transcribeRecordingWithOpenAI:
      vi.fn(),
  }),
)

import {
  createChatVoiceInputTranscriber,
} from '../src/modules/chat/chatVoiceInputService.js'

const userId =
  '507f1f77bcf86cd799439010'

const memoryId =
  '507f1f77bcf86cd799439011'

function createAudioFile() {
  return {
    buffer: Buffer.from([
      0x1a,
      0x45,
      0xdf,
      0xa3,
    ]),
    mimetype: 'audio/webm',
  }
}

afterEach(() => {
  vi.resetAllMocks()
})

describe('Chat voice-input service', () => {
  it('transcribes Hebrew audio without storing or sending the result', async () => {
    const transcribe = vi.fn()
      .mockResolvedValue({
        content:
          ' שלום, זה התמלול שלי. ',
      })

    mocks.leanConsent
      .mockResolvedValue({
        _id: 'consent-id',
      })

    const service =
      createChatVoiceInputTranscriber({
        transcribe,
      })

    const file = createAudioFile()
    const result = await service(
      userId,
      memoryId,
      file,
    )

    expect(
      mocks.requireMemoryPermission,
    ).toHaveBeenCalledWith(
      userId,
      memoryId,
      'manage',
    )

    expect(
      mocks.findConsent,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        memoryId,
        status: 'approved',
        'externalTranscriptionConsent.provider':
          'openai',
        'externalTranscriptionConsent.model':
          'gpt-transcribe',
        'externalTranscriptionConsent.languageCode':
          'he',
        'externalTranscriptionConsent.policyVersion':
          'openai-hebrew-chat-transcription-v1',
      }),
    )

    expect(transcribe)
      .toHaveBeenCalledWith({
        audioBuffer: file.buffer,
        originalFileName:
          'chat-voice-input.webm',
        mimeType: 'audio/webm',
        languageCode: 'he',
      })

    expect(result).toEqual({
      text:
        'שלום, זה התמלול שלי.',
      languageCode: 'he',
      audioStored: false,
      autoSent: false,
    })
  })

  it('does not send audio to OpenAI without current provider consent', async () => {
    const transcribe = vi.fn()

    mocks.leanConsent
      .mockResolvedValue(null)

    const service =
      createChatVoiceInputTranscriber({
        transcribe,
      })

    await expect(
      service(
        userId,
        memoryId,
        createAudioFile(),
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code:
        'CHAT_VOICE_INPUT_CONSENT_REQUIRED',
    })

    expect(transcribe)
      .not.toHaveBeenCalled()
  })

  it('rejects a transcript that cannot fit in the message composer', async () => {
    const transcribe = vi.fn()
      .mockResolvedValue({
        content: 'א'.repeat(2001),
      })

    mocks.leanConsent
      .mockResolvedValue({
        _id: 'consent-id',
      })

    const service =
      createChatVoiceInputTranscriber({
        transcribe,
      })

    await expect(
      service(
        userId,
        memoryId,
        createAudioFile(),
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      code:
        'CHAT_VOICE_INPUT_TRANSCRIPT_TOO_LONG',
    })
  })
})
