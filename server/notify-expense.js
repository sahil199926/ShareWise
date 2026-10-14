import { sendMail } from './mail.js'

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const rupee = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: Number.isInteger(Number(value)) ? 0 : 2,
  }).format(Number(value))

const safeOrigin = (value) => {
  try {
    const url = new URL(String(value))
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.origin
      : ''
  } catch {
    return ''
  }
}

const readExpense = (value) => {
  if (!value || typeof value !== 'object') return null
  const expense = {
    note: String(value.note ?? '').trim(),
    expenseDate: String(value.expenseDate ?? '').trim(),
    totalAmount: Number(value.totalAmount),
  }
  if (
    !expense.note ||
    !/^\d{4}-\d{2}-\d{2}$/.test(expense.expenseDate) ||
    !Number.isFinite(expense.totalAmount) ||
    expense.totalAmount <= 0
  ) {
    return null
  }
  return expense
}

const readDebt = (value) => {
  if (!value || typeof value !== 'object') return null
  const debt = {
    id: String(value.id ?? '').trim(),
    debtorName: String(value.debtorName ?? '').trim(),
    debtorEmail: String(value.debtorEmail ?? '')
      .trim()
      .toLowerCase(),
    creditorName: String(value.creditorName ?? '').trim(),
    amount: Number(value.amount),
  }
  if (
    !debt.id ||
    !debt.debtorName ||
    !isEmail(debt.debtorEmail) ||
    !debt.creditorName ||
    !Number.isFinite(debt.amount) ||
    debt.amount <= 0
  ) {
    return null
  }
  return debt
}

const buildMessage = (expense, debtor, origin) => {
  const total = debtor.debts.reduce((sum, debt) => sum + debt.amount, 0)
  const details = debtor.debts
    .map((debt) => `${debt.creditorName}: ${rupee(debt.amount)}`)
    .join('\n')
  const rows = debtor.debts
    .map(
      (debt) => `
        <tr>
          <td style="padding:10px 0;color:#166534;font-size:14px;">Give ${escapeHtml(debt.creditorName)}</td>
          <td align="right" style="padding:10px 0;color:#14532d;font-size:14px;font-weight:700;">${escapeHtml(rupee(debt.amount))}</td>
        </tr>`,
    )
    .join('')
  const action = origin
    ? `<a href="${escapeHtml(`${origin}/debt-overview`)}" style="display:inline-block;margin-top:22px;background:#16a34a;color:white;text-decoration:none;border-radius:999px;padding:12px 20px;font-weight:700;">View my debts</a>`
    : ''

  return {
    to: debtor.email,
    subject: `${expense.note}: you owe ${rupee(total)}`,
    text: `${expense.note} (${expense.expenseDate})\n\nYou owe:\n${details}\n\nTotal: ${rupee(total)}`,
    html: `<!doctype html>
      <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;background:#f7fcf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#14532d;">
        <div style="display:none;max-height:0;overflow:hidden;">Your share created ${debtor.debts.length} new ${debtor.debts.length === 1 ? 'debt' : 'debts'}.</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:white;border:1px solid #dcfce7;border-radius:28px;">
            <tr><td style="padding:28px 32px 8px;font-size:15px;font-weight:800;">₹ &nbsp;Karja Tracker</td></tr>
            <tr><td style="padding:18px 32px 0;color:#4d7c5f;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">New expense</td></tr>
            <tr><td style="padding:8px 32px 0;font-size:24px;font-weight:800;">${escapeHtml(expense.note)}</td></tr>
            <tr><td style="padding:4px 32px 0;color:#4d7c5f;font-size:13px;">${escapeHtml(expense.expenseDate)}</td></tr>
            <tr><td style="padding:18px 32px 0;font-size:36px;font-weight:800;color:#b91c1c;">${escapeHtml(rupee(total))}</td></tr>
            <tr><td style="padding:4px 32px 0;color:#4d7c5f;font-size:13px;">Total you need to give</td></tr>
            <tr><td style="padding:18px 32px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>${action}</td></tr>
            <tr><td style="padding:8px 32px 28px;color:#4d7c5f;font-size:13px;line-height:20px;">Ask to close each debt after you pay it.</td></tr>
          </table>
        </td></tr></table>
      </body></html>`,
  }
}

export const handleNotifyExpenseRequest = async (body, env = process.env) => {
  const expense = readExpense(body?.expense)
  const debts = Array.isArray(body?.debts) ? body.debts.map(readDebt) : []
  if (!expense || !debts.length || debts.some((debt) => !debt)) {
    return {
      status: 400,
      body: { error: 'This expense mail request is not valid.' },
    }
  }

  const groups = new Map()
  debts.forEach((debt) => {
    const current = groups.get(debt.debtorEmail) ?? {
      email: debt.debtorEmail,
      name: debt.debtorName,
      debts: [],
    }
    current.debts.push(debt)
    groups.set(debt.debtorEmail, current)
  })

  const origin = safeOrigin(body?.appUrl)
  let sent = 0
  for (const debtor of groups.values()) {
    let result
    try {
      result = await sendMail(env, buildMessage(expense, debtor, origin))
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
    return {
      status:
        result.reason === 'missing-config' || result.reason === 'domain'
          ? 503
          : 502,
      body: {
        sent,
        error:
          sent > 0
            ? 'The expense was created, but only some notification emails were sent.'
            : result.message ||
              'The expense was created, but its emails could not be sent.',
      },
    }
  }

  return { status: 200, body: { sent } }
}
