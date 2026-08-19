import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const mocks = vi.hoisted(() => ({
  transcribeChatVoiceInput:
    vi.fn(),
}))

vi.mock(
  '../src/modules/chat/chatVoiceInputService.js',
  () => ({
    transcribeChatVoiceInput:
      mocks.transcribeChatVoiceInput,
  }),
)

import {
  transcribeVoiceInput,
} from '../src/modules/chat/chatVoiceInputController.js'

function createResponse() {
  return {
    status: vi.fn()
      .mockReturnThis(),
    json: vi.fn()
      .mockReturnThis(),
  }
}

afterEach(() => {
  vi.resetAllMocks()
})

describe('Chat voice-input controller', () => {
  it('clears the temporary audio buffer after a successful transcription', async () => {
    const audioBuffer = Buffer.from([
      1,
      2,
      3,
      4,
    ])

    const req = {
      auth: {
        userId: 'user-id',
      },
      validatedParams: {
        memoryId: 'memory-id',
      },
      file: {
        buffer: audioBuffer,
        mimetype: 'audio/webm',
      },
    }

    const res = createResponse()

    mocks.transcribeChatVoiceInput
      .mockResolvedValue({
        text: 'שלום',
        languageCode: 'he',
        audioStored: false,
        autoSent: false,
      })

    await transcribeVoiceInput(
      req,
      res,
    )

    expect(req).not.toHaveProperty(
      'file',
    )
    expect([...audioBuffer]).toEqual([
      0,
      0,
      0,
      0,
    ])

    expect(res.status)
      .toHaveBeenCalledWith(200)
  })

  it('also clears the temporary audio buffer when transcription fails', async () => {
    const audioBuffer = Buffer.from([
      5,
      6,
      7,
    ])

    const req = {
      auth: {
        userId: 'user-id',
      },
      validatedParams: {
        memoryId: 'memory-id',
      },
      file: {
        buffer: audioBuffer,
        mimetype: 'audio/webm',
      },
    }

    mocks.transcribeChatVoiceInput
      .mockRejectedValue(
        new Error('provider failed'),
      )

    await expect(
      transcribeVoiceInput(
        req,
        createResponse(),
      ),
    ).rejects.toThrow(
      'provider failed',
    )

    expect(req).not.toHaveProperty(
      'file',
    )
    expect([...audioBuffer]).toEqual([
      0,
      0,
      0,
    ])
  })
})
