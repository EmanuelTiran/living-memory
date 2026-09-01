import { describe, expect, it } from 'vitest'
import {
  getMemoryChatLauncherState,
} from '../../client/src/features/chat/memoryChatLauncherState.js'

describe('memory chat launcher source readiness', () => {
  it('stays closed when the source check failed', () => {
    expect(
      getMemoryChatLauncherState({
        hasApprovedSources: false,
        isCheckingSources: false,
        sourceCheckFailed: true,
      }),
    ).toBe('error')
  })

  it('does not let a stale positive result override a current error', () => {
    expect(
      getMemoryChatLauncherState({
        hasApprovedSources: true,
        isCheckingSources: false,
        sourceCheckFailed: true,
      }),
    ).toBe('error')
  })

  it('opens only after an approved source is known', () => {
    expect(
      getMemoryChatLauncherState({
        hasApprovedSources: true,
        isCheckingSources: false,
        sourceCheckFailed: false,
      }),
    ).toBe('ready')
  })
})
