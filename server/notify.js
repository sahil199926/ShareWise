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

const paragraph = (text) => `<p>${escapeHtml(text)}</p>`

const letter = ({ heading, lines, action }) => {
  const body = lines.map((line) => paragraph(line)).join('')
  const button = action
    ? `<p><a href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a></p>`
    : ''

  return `<div>${paragraph(heading)}${body}${button}</div>`
}

const createdMessages = (debt) => {
  const amount = rupee(debt.amount)
  const note = debt.note ? ` Note: ${debt.note}` : ''

  return [
    {
      to: debt.debtorEmail,
      subject: `You owe ${debt.creditorName} ${amount}`,
      text: `A karja was added. You will give ${debt.creditorName} ${amount}.${note}`,
      html: letter({
        heading: 'A new karja was added',
        lines: [
          `You will give ${debt.creditorName} ${amount}.`,
          debt.note ? `Note: ${debt.note}` : '',
        ].filter(Boolean),
      }),
    },
    {
      to: debt.creditorEmail,
      subject: `${debt.debtorName} owes you ${amount}`,
      text: `A karja was added. ${debt.debtorName} will give you ${amount}.${note}`,
      html: letter({
        heading: 'A new karja was added',
        lines: [
          `${debt.debtorName} will give you ${amount}.`,
          debt.note ? `Note: ${debt.note}` : '',
        ].filter(Boolean),
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
      subject: `We got your paid request for ${amount}`,
      text: `You asked to close ${amount} owed to ${debt.creditorName}. We emailed them so they can confirm.`,
      html: letter({
        heading: 'Paid request received',
        lines: [
          `You asked to close ${amount} owed to ${debt.creditorName}.`,
          'We emailed them so they can confirm.',
        ],
      }),
    },
    {
      to: debt.creditorEmail,
      subject: `${debt.debtorName} says they paid ${amount}`,
      text: `${debt.debtorName} asked to close ${amount}. ${confirmLine}`,
      html: letter({
        heading: 'Please confirm this payment',
        lines: [
          `${debt.debtorName} says they paid ${amount}.`,
          'Confirm only if you have received it.',
        ],
        action: confirmUrl
          ? { href: confirmUrl, label: 'Confirm payment' }
          : undefined,
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

export const handleNotifyRequest = async (body, env = process.env) => {
  const kind = body?.kind
  const debt = readDebt(body?.debt)

  if ((kind !== 'debt_created' && kind !== 'payment_requested') || !debt) {
    return { status: 400, body: { error: 'This mail request is not valid.' } }
  }

  const origin = safeOrigin(body?.appUrl)
  const messages = uniqueMessages(
    kind === 'debt_created'
      ? createdMessages(debt)
      : paymentMessages(debt, origin),
  )

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
