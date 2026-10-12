import { sendMail } from './mail.js'

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const rupee = (value) => {
  const amount = Number(value)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount)
}

const safeOrigin = (value) => {
  try {
    const url = new URL(String(value))
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return ''
    return url.origin
  } catch {
    return ''
  }
}

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const readDebt = (value) => {
  if (!value || typeof value !== 'object') return null

  const debt = {
    id: String(value.id ?? '').trim(),
    debtorName: String(value.debtorName ?? '').trim(),
    debtorEmail: String(value.debtorEmail ?? '')
      .trim()
      .toLowerCase(),
    creditorName: String(value.creditorName ?? '').trim(),
    creditorEmail: String(value.creditorEmail ?? '')
      .trim()
      .toLowerCase(),
    amount: Number(value.amount),
    note: String(value.note ?? '').trim(),
  }

  if (
    !debt.id ||
    !debt.debtorName ||
    !debt.creditorName ||
    !isEmail(debt.debtorEmail) ||
    !isEmail(debt.creditorEmail) ||
    !Number.isFinite(debt.amount) ||
    debt.amount <= 0
  ) {
    return null
  }

  return debt
}

const amountColor = {
  give: '#b91c1c',
  get: '#15803d',
  closed: '#14532d',
}

const letter = ({
  preheader,
  eyebrow,
  heading,
  amount,
  tone = 'get',
  line,
  note,
  action,
  footnote,
}) => {
  const hidden = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f7fcf9;font-size:1px;line-height:1px;">${escapeHtml(preheader)}</div>`
    : ''
  const noteBlock = note
    ? `<tr><td style="padding:14px 32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4d7c5f;">Note</div><div style="padding-top:4px;font-size:14px;line-height:22px;color:#166534;">${escapeHtml(note)}</div></td></tr>`
    : ''
  const button = action
    ? `<tr><td align="left" style="padding:20px 32px 8px;">
        <a href="${escapeHtml(action.href)}" style="display:inline-block;background:#16a34a;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:600;line-height:20px;text-decoration:none;border-radius:999px;padding:12px 22px;">${escapeHtml(action.label)}</a>
      </td></tr>
      <tr><td style="padding:0 32px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;line-height:18px;color:#4d7c5f;">Or open this link:<br><a href="${escapeHtml(action.href)}" style="color:#15803d;word-break:break-all;">${escapeHtml(action.href)}</a></td></tr>`
    : ''
  const foot = footnote
    ? `<tr><td style="padding:8px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:20px;color:#4d7c5f;">${escapeHtml(footnote)}</td></tr>`
    : `<tr><td style="padding:0 0 12px;font-size:0;line-height:0;">&nbsp;</td></tr>`

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7fcf9;">
  ${hidden}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7fcf9;">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #dcfce7;border-radius:28px;">
          <tr>
            <td style="padding:28px 32px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;background:#16a34a;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:18px;font-weight:700;color:#ffffff;">&#8377;</td>
                  <td style="padding-left:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:700;color:#14532d;">Karja Tracker</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4d7c5f;">${escapeHtml(eyebrow)}</td>
          </tr>
          <tr>
            <td style="padding:8px 32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:22px;line-height:30px;font-weight:700;color:#14532d;">${escapeHtml(heading)}</td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:36px;line-height:40px;font-weight:700;color:${amountColor[tone] || amountColor.get};">${escapeHtml(amount)}</td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7fcf9;border-radius:16px;">
                <tr>
                  <td style="padding:14px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:22px;color:#166534;">${escapeHtml(line)}</td>
                </tr>
              </table>
            </td>
          </tr>
          ${noteBlock}
          ${button}
          ${foot}
        </table>
        <p style="margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;line-height:18px;color:#4d7c5f;">Karja Tracker · money between friends</p>
        <p style="margin:4px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;line-height:18px;color:#4d7c5f;">A product of Eonlint</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

const createdMessages = (debt) => {
  const amount = rupee(debt.amount)
  const note = debt.note ? `Note: ${debt.note}` : ''

  return [
    {
      to: debt.debtorEmail,
      subject: `You will give ${debt.creditorName} ${amount}`,
      text: `A new karja was added. You will give ${debt.creditorName} ${amount}.${note ? ` ${note}` : ''}`,
      html: letter({
        preheader: `You will give ${debt.creditorName} ${amount}.`,
        eyebrow: 'New karja',
        heading: `You will give ${debt.creditorName}`,
        amount,
        tone: 'give',
        line: `${debt.debtorName} will give ${debt.creditorName}`,
        note: debt.note,
        footnote: 'Ask to close it in Karja Tracker once you have paid.',
      }),
    },
    {
      to: debt.creditorEmail,
      subject: `${debt.debtorName} will give you ${amount}`,
      text: `A new karja was added. ${debt.debtorName} will give you ${amount}.${note ? ` ${note}` : ''}`,
      html: letter({
        preheader: `${debt.debtorName} will give you ${amount}.`,
        eyebrow: 'New karja',
        heading: `${debt.debtorName} will give you`,
        amount,
        tone: 'get',
        line: `${debt.debtorName} will give ${debt.creditorName}`,
        note: debt.note,
        footnote: 'You can mark it closed once you have the money.',
      }),
    },
  ]
}

const paymentMessages = (debt, origin) => {
  const amount = rupee(debt.amount)
  const confirmUrl = origin
    ? `${origin}/confirm-payment/${encodeURIComponent(debt.id)}`
    : ''
  const confirmLine = confirmUrl
    ? `Confirm you received it: ${confirmUrl}`
    : 'Open Karja Tracker and confirm you received it.'

  return [
    {
      to: debt.debtorEmail,
      subject: `Paid request sent for ${amount}`,
      text: `You asked to close ${amount} owed to ${debt.creditorName}. We emailed them so they can confirm.`,
      html: letter({
        preheader: `${debt.creditorName} can confirm this ${amount} payment.`,
        eyebrow: 'Paid request',
        heading: `Waiting on ${debt.creditorName}`,
        amount,
        tone: 'give',
        line: `${debt.debtorName} is giving ${debt.creditorName}`,
        note: debt.note,
        footnote: 'We emailed them. This stays open until they confirm.',
      }),
    },
    {
      to: debt.creditorEmail,
      subject: `${debt.debtorName} says they paid ${amount}`,
      text: `${debt.debtorName} asked to close ${amount}. ${confirmLine}`,
      html: letter({
        preheader: `${debt.debtorName} says they paid you ${amount}.`,
        eyebrow: 'Please confirm',
        heading: `${debt.debtorName} says they paid`,
        amount,
        tone: 'get',
        line: `${debt.debtorName} is giving ${debt.creditorName}`,
        note: debt.note,
        action: confirmUrl
          ? { href: confirmUrl, label: 'Confirm payment' }
          : undefined,
        footnote: 'Confirm only if you have received the money.',
      }),
    },
  ]
}

const closedMessages = (debt) => {
  const amount = rupee(debt.amount)

  return [
    {
      to: debt.debtorEmail,
      subject: `Closed: you gave ${debt.creditorName} ${amount}`,
      text: `This karja is closed. You have given ${debt.creditorName} ${amount}.`,
      html: letter({
        preheader: `You have given ${debt.creditorName} ${amount}.`,
        eyebrow: 'Closed',
        heading: `You have given ${debt.creditorName}`,
        amount,
        tone: 'closed',
        line: `${debt.debtorName} has given ${debt.creditorName}`,
        note: debt.note,
        footnote: 'This karja is closed. Nothing else is owed on it.',
      }),
    },
    {
      to: debt.creditorEmail,
      subject: `Closed: ${debt.debtorName} gave you ${amount}`,
      text: `This karja is closed. ${debt.debtorName} has given you ${amount}.`,
      html: letter({
        preheader: `${debt.debtorName} has given you ${amount}.`,
        eyebrow: 'Closed',
        heading: `${debt.debtorName} has given you`,
        amount,
        tone: 'closed',
        line: `${debt.debtorName} has given ${debt.creditorName}`,
        note: debt.note,
        footnote: 'This karja is closed. Nothing else is owed on it.',
      }),
    },
  ]
}

const uniqueMessages = (messages) => {
  const seen = new Set()

  return messages.filter((message) => {
    const key = `${message.to}:${message.subject}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const previewNotifyHtml = (kind, debt, origin = '') => {
  if (kind === 'debt_created') return createdMessages(debt)
  if (kind === 'debt_closed') return closedMessages(debt)
  return paymentMessages(debt, origin)
}

export const handleNotifyRequest = async (body, env = process.env) => {
  const kind = body?.kind
  const debt = readDebt(body?.debt)

  if (
    (kind !== 'debt_created' &&
      kind !== 'payment_requested' &&
      kind !== 'debt_closed') ||
    !debt
  ) {
    return { status: 400, body: { error: 'This mail request is not valid.' } }
  }

  const origin = safeOrigin(body?.appUrl)
  const messages = uniqueMessages(previewNotifyHtml(kind, debt, origin))

  let sent = 0

  for (const message of messages) {
    let result

    try {
      result = await sendMail(env, message)
    } catch {
      result = {
        sent: false,
        reason: 'provider',
        message: 'The email could not be sent.',
      }
    }

    if (result.sent) {
      sent += 1
      continue
    }

    if (result.reason === 'missing-config') {
      return {
        status: 503,
        body: {
          error:
            'Mail is not set up yet, so no email was sent. Add a Resend API key as RESEND_API_KEY.',
        },
      }
    }

    return {
      status: result.reason === 'domain' ? 503 : 502,
      body: {
        error:
          sent > 0
            ? 'Only some of the emails could be sent.'
            : result.message || 'The email could not be sent.',
      },
    }
  }

  return { status: 200, body: { sent } }
}
