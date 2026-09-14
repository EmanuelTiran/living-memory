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
    publicAppUrl:
      'https://zikaron-hai.co.il/base/path',
  },
}))

import {
  createFamilyInvitationUrl,
  sendFamilyInvitationEmail,
} from '../src/modules/memories/familyInvitationMailService.js'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Family invitation mail service', () => {
  it('creates a canonical invitation URL from the configured public origin', () => {
    expect(
      createFamilyInvitationUrl(
        'secure_invitation-token',
      ),
    ).toBe(
      'https://zikaron-hai.co.il/invitation#token=secure_invitation-token',
    )
  })

  it('sends an RTL Hebrew family invitation through Postmark', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    })

    vi.stubGlobal('fetch', fetchMock)

    const invitationUrl =
      'https://zikaron-hai.co.il/invitation#token=secure-token'

    await sendFamilyInvitationEmail({
      to: 'family@example.com',
      invitationUrl,
      subjectName: 'רות <משפחה>',
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
      To: 'family@example.com',
      Subject:
        'הזמנה לארכיון המשפחתי בזיכרון חי',
      MessageStream: 'outbound',
      Tag: 'family-invitation',
      TrackOpens: false,
      TrackLinks: 'None',
    })
    expect(body.TextBody).toContain(
      invitationUrl,
    )
    expect(body.TextBody).toContain(
      '14 ימים',
    )
    expect(body.HtmlBody).toContain(
      'dir="rtl"',
    )
    expect(body.HtmlBody).toContain(
      invitationUrl,
    )
    expect(body.HtmlBody).toContain(
      'פתיחת ההזמנה',
    )
    expect(body.HtmlBody).toContain(
      '14 ימים',
    )
    expect(body.HtmlBody).toContain(
      'רות &lt;משפחה&gt;',
    )
    expect(body.HtmlBody).not.toContain(
      'רות <משפחה>',
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
      sendFamilyInvitationEmail({
        to: 'family@example.com',
        invitationUrl:
          'https://zikaron-hai.co.il/invitation#token=secure-token',
        subjectName: 'רות',
      }),
    ).rejects.toThrow(
      'Transactional email delivery failed.',
    )
  })
})
