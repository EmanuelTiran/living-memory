import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  createDIDRealtimeAudioGrant,
  resetDIDRealtimeAudioGrantsForTests,
  takeDIDRealtimeAudioGrant,
} from '../src/modules/digitalPersona/didRealtimeAudioStore.js'

const grantInput = {
  userId: 'user-1',
  memoryId: 'memory-1',
  conversationId: 'conversation-1',
  messageId: 'message-1',
  resourceId: 'audio-resource-1',
  onExpire: vi.fn(),
}

afterEach(() => {
  resetDIDRealtimeAudioGrantsForTests()
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('D-ID realtime audio grants', () => {
  it('allows the owner to consume a release token only once', () => {
    const token =
      createDIDRealtimeAudioGrant(
        grantInput,
      )

    expect(
      takeDIDRealtimeAudioGrant({
        token,
        userId: 'user-1',
        memoryId: 'memory-1',
      }),
    ).toEqual({
      resourceId: 'audio-resource-1',
    })

    expect(() =>
      takeDIDRealtimeAudioGrant({
        token,
        userId: 'user-1',
        memoryId: 'memory-1',
      }),
    ).toThrowError(
      expect.objectContaining({
        code:
          'DID_REALTIME_AUDIO_NOT_FOUND',
      }),
    )
  })

  it('does not reveal a token owned by another user', () => {
    const token =
      createDIDRealtimeAudioGrant(
        grantInput,
      )

    expect(() =>
      takeDIDRealtimeAudioGrant({
        token,
        userId: 'user-2',
        memoryId: 'memory-1',
      }),
    ).toThrowError(
      expect.objectContaining({
        statusCode: 404,
      }),
    )
  })

  it('deletes an unclaimed temporary resource after expiration', async () => {
    vi.useFakeTimers()
    const onExpire = vi.fn()

    createDIDRealtimeAudioGrant({
      ...grantInput,
      onExpire,
    })

    await vi.advanceTimersByTimeAsync(
      15 * 60 * 1000,
    )

    expect(onExpire).toHaveBeenCalledWith(
      'audio-resource-1',
    )
  })
})
