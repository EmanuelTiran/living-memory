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

export function createFamilyInvitationUrl(
  token,
) {
  if (!env.publicAppUrl) {
    throw new Error(
      'Public application URL is not configured.',
    )
  }

  const invitationUrl = new URL(
    '/invitation',
    env.publicAppUrl,
  )

  invitationUrl.hash = new URLSearchParams({
    token,
  }).toString()

  return invitationUrl.toString()
}

function createFamilyInvitationMessage({
  invitationUrl,
  subjectName,
}) {
  const safeInvitationUrl = escapeHtml(
    invitationUrl,
  )
  const safeSubjectName = escapeHtml(
    subjectName,
  )

  return {
    subject:
      'הזמנה לארכיון המשפחתי בזיכרון חי',
    textBody: [
      'זיכרון חי / Living Memory',
      '',
      `הוזמנתם להצטרף לארכיון המשפחתי של ${subjectName}.`,
      '',
      'פתיחת ההזמנה:',
      invitationUrl,
      '',
      'ההזמנה אישית ומיועדת לכתובת האימייל שאליה נשלחה.',
      'הקישור תקף למשך 14 ימים וניתן למימוש פעם אחת.',
      'כדי להצטרף יש להתחבר או להירשם באמצעות כתובת האימייל שאליה נשלחה ההזמנה.',
      '',
      'אם לא ציפיתם לקבל את ההזמנה, אפשר להתעלם מהודעה זו.',
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
              <td style="font-size:28px;font-weight:700;line-height:1.35;padding-bottom:18px">הזמנה לארכיון המשפחתי</td>
            </tr>
            <tr>
              <td style="color:#5f6b67;font-size:17px;line-height:1.7;padding-bottom:24px">הוזמנתם להצטרף לארכיון המשפחתי של ${safeSubjectName}.</td>
            </tr>
            <tr>
              <td style="padding-bottom:24px">
                <a href="${safeInvitationUrl}" style="display:inline-block;background:#486b5d;color:#fffdf8;text-decoration:none;font-size:17px;font-weight:700;padding:14px 24px;border-radius:12px">פתיחת ההזמנה</a>
              </td>
            </tr>
            <tr>
              <td style="color:#5f6b67;font-size:15px;line-height:1.7;padding-bottom:12px">ההזמנה אישית ומיועדת לכתובת האימייל שאליה נשלחה. הקישור תקף למשך 14 ימים וניתן למימוש פעם אחת.</td>
            </tr>
            <tr>
              <td style="color:#5f6b67;font-size:15px;line-height:1.7;padding-bottom:12px">כדי להצטרף יש להתחבר או להירשם באמצעות כתובת האימייל שאליה נשלחה ההזמנה.</td>
            </tr>
            <tr>
              <td style="color:#707872;font-size:14px;line-height:1.7">אם לא ציפיתם לקבל את ההזמנה, אפשר להתעלם מהודעה זו.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  }
}

export async function sendFamilyInvitationEmail({
  to,
  invitationUrl,
  subjectName,
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
    createFamilyInvitationMessage({
      invitationUrl,
      subjectName,
    })

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
        Tag: 'family-invitation',
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
