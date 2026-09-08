import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

vi.mock('../src/config/env.js', () => ({
  env: {
    postmarkServerToken:
      'test-postmark-server-token',
    mailFromAddress:
      'support@zikaron-hai.co.il',
    mailFromName: 'זיכרון חי',
    publicAppUrl: 'https://zikaron-hai.co.il',
  },
}))

import {
  sendPasswordResetEmail,
} from '../src/modules/auth/passwordResetMailService.js'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Password reset mail service', () => {
  it('sends an RTL Hebrew transactional email through Postmark', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    })

    vi.stubGlobal('fetch', fetchMock)

    const resetUrl =
      'https://zikaron-hai.co.il/reset-password?token=secure-token'

    await sendPasswordResetEmail({
      to: 'user@example.com',
      resetUrl,
    })

    expect(fetchMock).toHaveBeenCalledOnce()

    const [url, requestOptions] =
      fetchMock.mock.calls[0]
    const body = JSON.parse(
      requestOptions.body,
    )

    expect(url).toBe(
      'https://api.postmarkapp.com/email',
    )
    expect(requestOptions).toMatchObject({
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token':
          'test-postmark-server-token',
      },
      signal: expect.any(AbortSignal),
    })
    expect(body).toMatchObject({
      From:
        'זיכרון חי <support@zikaron-hai.co.il>',
      To: 'user@example.com',
      Subject:
        'איפוס הסיסמה שלך בזיכרון חי',
      MessageStream: 'outbound',
      Tag: 'password-reset',
      TrackOpens: false,
      TrackLinks: 'None',
    })
    expect(body.TextBody).toContain(resetUrl)
    expect(body.TextBody).toContain('30 דקות')
    expect(body.HtmlBody).toContain('dir="rtl"')
    expect(body.HtmlBody).toContain(resetUrl)
    expect(body.HtmlBody).toContain(
      'בחירת סיסמה חדשה',
    )
  })

  it('treats a non-success provider response as delivery failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    )

    await expect(
      sendPasswordResetEmail({
        to: 'user@example.com',
        resetUrl:
          'https://zikaron-hai.co.il/reset-password?token=secure-token',
      }),
    ).rejects.toThrow(
      'Transactional email delivery failed.',
    )
  })
})
