import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  getChatAvatarPresentation,
} from '../../client/src/features/chat/chatAvatarPresentation.js'

describe('chat avatar presentation state', () => {
  it('shows listening while the microphone is recording', () => {
    expect(
      getChatAvatarPresentation({
        voiceInputPhase: 'recording',
        speechStatus: 'playing',
      }),
    ).toMatchObject({
      mode: 'listening',
    })
  })

  it('shows voice preparation as soon as an answer is ready for speech', () => {
    expect(
      getChatAvatarPresentation({
        isSending: true,
        speechStatus: 'loading',
        avatarStatus: 'preparing',
      }),
    ).toMatchObject({
      mode: 'preparing-voice',
    })
  })

  it('keeps speaking visible while D-ID continues in the background', () => {
    const presentation =
      getChatAvatarPresentation({
        speechStatus: 'playing',
        avatarStatus: 'preparing',
      })

    expect(presentation).toMatchObject({
      mode: 'speaking',
    })

    expect(presentation.detail)
      .toContain('ברקע')
  })

  it('marks prepared audio when the browser blocks autoplay', () => {
    expect(
      getChatAvatarPresentation({
        speechStatus: 'ready',
      }),
    ).toMatchObject({
      mode: 'voice-ready',
    })
  })

  it('shows the realtime connection while approved audio is prepared', () => {
    expect(
      getChatAvatarPresentation({
        speechStatus: 'loading',
        avatarStatus:
          'realtime-preparing',
        realtimeStatus:
          'connecting',
      }),
    ).toMatchObject({
      mode: 'realtime-connecting',
    })
  })

  it('describes synchronized speech during a realtime stream', () => {
    const presentation =
      getChatAvatarPresentation({
        speechStatus: 'playing',
        avatarStatus:
          'realtime-speaking',
        realtimeStatus: 'speaking',
      })

    expect(presentation).toMatchObject({
      mode: 'speaking',
    })
    expect(presentation.detail)
      .toContain('מסונכרנים')
  })

  it('reports a warmed realtime session as ready', () => {
    expect(
      getChatAvatarPresentation({
        realtimeStatus: 'ready',
      }),
    ).toMatchObject({
      mode: 'idle',
      label: 'מוכן לשיחה חיה',
    })
  })

  it('marks a late video as optional instead of replaying it', () => {
    const presentation =
      getChatAvatarPresentation({
        avatarStatus: 'ready',
      })

    expect(presentation).toMatchObject({
      mode: 'video-ready',
    })

    expect(presentation.detail)
      .toContain('לא יופעל מעצמו')
  })
})
