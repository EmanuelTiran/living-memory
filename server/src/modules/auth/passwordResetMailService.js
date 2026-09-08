import { env } from '../../config/env.js'

const POSTMARK_EMAIL_URL =
  'https://api.postmarkapp.com/email'
const POSTMARK_TIMEOUT_MS = 10_000

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function createPasswordResetMessage(resetUrl) {
  const safeResetUrl = escapeHtml(resetUrl)

  return {
    subject: 'איפוס הסיסמה שלך בזיכרון חי',
    textBody: [
      'זיכרון חי / Living Memory',
      '',
      'קיבלנו בקשה לאיפוס הסיסמה שלך.',
      '',
      'לבחירת סיסמה חדשה:',
      resetUrl,
      '',
      'הקישור תקף למשך 30 דקות.',
      '',
      'אם לא ביקשתם לאפס את הסיסמה, אפשר להתעלם מהמייל הזה.',
    ].join('\n'),
    htmlBody: `<!doctype html>
<html lang="he" dir="rtl">
  <body style="margin:0;background:#f3eee5;color:#24332e;font-family:Arial,sans-serif;direction:rtl;text-align:right">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3eee5;padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fffdf9;border:1px solid #d8ccba;border-radius:20px;padding:36px">
            <tr>
              <td style="color:#a4573e;font-size:14px;font-weight:700;padding-bottom:14px">זיכרון חי / Living Memory</td>
            </tr>
            <tr>
              <td style="font-size:28px;font-weight:700;line-height:1.35;padding-bottom:18px">איפוס הסיסמה שלך</td>
            </tr>
            <tr>
              <td style="color:#5f6b67;font-size:17px;line-height:1.7;padding-bottom:24px">קיבלנו בקשה לאיפוס הסיסמה שלך בזיכרון חי.</td>
            </tr>
            <tr>
              <td style="padding-bottom:24px">
                <a href="${safeResetUrl}" style="display:inline-block;background:#486b5d;color:#fffdf8;text-decoration:none;font-size:17px;font-weight:700;padding:14px 24px;border-radius:12px">בחירת סיסמה חדשה</a>
              </td>
            </tr>
            <tr>
              <td style="color:#5f6b67;font-size:15px;line-height:1.7;padding-bottom:12px">הקישור תקף למשך 30 דקות.</td>
            </tr>
            <tr>
              <td style="color:#707872;font-size:14px;line-height:1.7">אם לא ביקשתם לאפס את הסיסמה, אפשר להתעלם מהמייל הזה.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  }
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}) {
  if (
    !env.postmarkServerToken ||
    !env.mailFromAddress ||
    !env.publicAppUrl
  ) {
    throw new Error(
      'Transactional email is not configured.',
    )
  }

  const message =
    createPasswordResetMessage(resetUrl)

  const response = await fetch(
    POSTMARK_EMAIL_URL,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token':
          env.postmarkServerToken,
      },
      body: JSON.stringify({
        From: `${env.mailFromName} <${env.mailFromAddress}>`,
        To: to,
        Subject: message.subject,
        TextBody: message.textBody,
        HtmlBody: message.htmlBody,
        MessageStream: 'outbound',
        Tag: 'password-reset',
        TrackOpens: false,
        TrackLinks: 'None',
      }),
      signal: AbortSignal.timeout(
        POSTMARK_TIMEOUT_MS,
      ),
    },
  )

  if (!response.ok) {
    throw new Error(
      'Transactional email delivery failed.',
    )
  }
}
