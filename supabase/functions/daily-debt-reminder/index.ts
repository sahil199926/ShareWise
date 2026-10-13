import { withSupabase } from 'npm:@supabase/server@^1'

type Candidate = {
  debt_id: string
  debtor_id: string
  debtor_name: string
  debtor_email: string
  creditor_name: string
  amount: number | string
  note: string | null
  created_at: string
}

type ReminderGroup = {
  userId: string
  name: string
  email: string
  debts: Candidate[]
}

const escapeHtml = (value: unknown) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const rupee = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value)

const dateInTimeZone = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return `${read('year')}-${read('month')}-${read('day')}`
}

const groupCandidates = (rows: Candidate[]) => {
  const grouped = new Map<string, ReminderGroup>()

  for (const row of rows) {
    const email = String(row.debtor_email ?? '')
      .trim()
      .toLowerCase()
    const amount = Number(row.amount)

    if (
      !row.debtor_id ||
      !row.debt_id ||
      !isEmail(email) ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      continue
    }

    const current = grouped.get(row.debtor_id) ?? {
      userId: row.debtor_id,
      name: String(row.debtor_name || 'there').trim(),
      email,
      debts: [],
    }

    current.debts.push({ ...row, amount })
    grouped.set(row.debtor_id, current)
  }

  return [...grouped.values()]
}

const reminderEmail = (group: ReminderGroup, appUrl: string) => {
  const total = group.debts.reduce((sum, debt) => sum + Number(debt.amount), 0)
  const visibleDebts = group.debts.slice(0, 50)
  const hiddenCount = group.debts.length - visibleDebts.length
  const subject = `Reminder: you have ${rupee(total)} left to pay`
  const rows = visibleDebts
    .map((debt) => {
      const note = debt.note?.trim()
        ? `<div style="padding-top:3px;color:#64748b;font-size:13px;">${escapeHtml(debt.note)}</div>`
        : ''

      return `<tr>
        <td style="padding:14px 0;border-bottom:1px solid #dcfce7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#14532d;">
          <div style="font-size:15px;font-weight:650;">${escapeHtml(debt.creditor_name)}</div>
          ${note}
        </td>
        <td align="right" style="padding:14px 0;border-bottom:1px solid #dcfce7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:700;color:#b91c1c;white-space:nowrap;">${escapeHtml(rupee(Number(debt.amount)))}</td>
      </tr>`
    })
    .join('')
  const more = hiddenCount
    ? `<p style="margin:14px 0 0;color:#64748b;font-size:13px;">And ${hiddenCount} more open payment${hiddenCount === 1 ? '' : 's'}.</p>`
    : ''
  const action = appUrl
    ? `<tr><td style="padding:24px 32px 8px;">
        <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#16a34a;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:650;text-decoration:none;border-radius:999px;padding:12px 22px;">Open Karja Tracker</a>
      </td></tr>`
    : ''

  const textLines = visibleDebts.map(
    (debt) =>
      `- ${debt.creditor_name}: ${rupee(Number(debt.amount))}${debt.note?.trim() ? ` (${debt.note.trim()})` : ''}`,
  )
  if (hiddenCount) textLines.push(`- And ${hiddenCount} more`)

  return {
    subject,
    text: [
      `Hi ${group.name},`,
      '',
      `You have ${group.debts.length} open payment${group.debts.length === 1 ? '' : 's'} totalling ${rupee(total)}:`,
      ...textLines,
      '',
      appUrl ? `Open Karja Tracker: ${appUrl}` : '',
    ]
      .filter((line, index, lines) => line || lines[index - 1] !== '')
      .join('\n'),
    html: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7fcf9;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">You have ${escapeHtml(rupee(total))} in open payments.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7fcf9;">
    <tr><td align="center" style="padding:28px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dcfce7;border-radius:28px;">
        <tr><td style="padding:28px 32px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:700;color:#14532d;">&#8377;&nbsp; Karja Tracker</td></tr>
        <tr><td style="padding:18px 32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#4d7c5f;">Daily reminder</td></tr>
        <tr><td style="padding:8px 32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:23px;line-height:31px;font-weight:700;color:#14532d;">Hi ${escapeHtml(group.name)}, you still have money to give</td></tr>
        <tr><td style="padding:14px 32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:36px;line-height:42px;font-weight:750;color:#b91c1c;">${escapeHtml(rupee(total))}</td></tr>
        <tr><td style="padding:18px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
          ${more}
        </td></tr>
        ${action}
        <tr><td style="padding:12px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:20px;color:#4d7c5f;">Once you pay, request to close the karja so the receiver can confirm it.</td></tr>
      </table>
      <p style="margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#4d7c5f;">Karja Tracker · money between friends</p>
    </td></tr>
  </table>
</body>
</html>`,
    total,
  }
}

const sendWithResend = async (
  apiKey: string,
  from: string,
  to: string,
  message: { subject: string; text: string; html: string },
  idempotencyKey: string,
) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ from, to: [to], ...message }),
  })
  const payload = (await response.json().catch(() => ({}))) as {
    id?: string
    message?: string
  }

  if (!response.ok || !payload.id) {
    throw new Error(
      payload.message || `Resend returned HTTP ${response.status}`,
    )
  }

  return payload.id
}

export default {
  fetch: withSupabase({ auth: 'secret' }, async (request, ctx) => {
    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')?.trim() ?? ''
    const mailFromValue = Deno.env.get('MAIL_FROM')?.trim() ?? ''
    const appUrl = (Deno.env.get('APP_URL')?.trim() ?? '').replace(/\/$/, '')
    const timeZone =
      Deno.env.get('REMINDER_TIME_ZONE')?.trim() || 'Asia/Kolkata'

    if (!resendApiKey || !mailFromValue) {
      return Response.json(
        { error: 'RESEND_API_KEY and MAIL_FROM must be configured.' },
        { status: 503 },
      )
    }

    const mailFrom = mailFromValue.includes('<')
      ? mailFromValue
      : `Karja Tracker <${mailFromValue}>`
    const reminderDate = dateInTimeZone(new Date(), timeZone)
    const { data, error } = await ctx.supabaseAdmin.rpc(
      'daily_reminder_candidates',
    )

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    const groups = groupCandidates((data ?? []) as Candidate[])
    let sent = 0
    let skipped = 0
    let failed = 0

    for (const group of groups) {
      const { data: previous, error: previousError } = await ctx.supabaseAdmin
        .from('daily_reminder_deliveries')
        .select('status, attempt_count')
        .eq('user_id', group.userId)
        .eq('reminder_date', reminderDate)
        .maybeSingle()

      if (previousError) {
        failed += 1
        continue
      }

      if (previous?.status === 'sent') {
        skipped += 1
        continue
      }

      const message = reminderEmail(group, appUrl)
      const attemptCount = Number(previous?.attempt_count ?? 0) + 1
      const { error: claimError } = await ctx.supabaseAdmin
        .from('daily_reminder_deliveries')
        .upsert(
          {
            user_id: group.userId,
            reminder_date: reminderDate,
            status: 'sending',
            debt_count: group.debts.length,
            total_amount: message.total,
            provider_email_id: null,
            error_message: null,
            attempt_count: attemptCount,
            sent_at: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,reminder_date' },
        )

      if (claimError) {
        failed += 1
        continue
      }

      try {
        const providerEmailId = await sendWithResend(
          resendApiKey,
          mailFrom,
          group.email,
          message,
          `daily-debt-reminder/${reminderDate}/${group.userId}`,
        )

        await ctx.supabaseAdmin
          .from('daily_reminder_deliveries')
          .update({
            status: 'sent',
            provider_email_id: providerEmailId,
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', group.userId)
          .eq('reminder_date', reminderDate)
        sent += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        await ctx.supabaseAdmin
          .from('daily_reminder_deliveries')
          .update({
            status: 'failed',
            error_message: message.slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', group.userId)
          .eq('reminder_date', reminderDate)
        failed += 1
      }
    }

    return Response.json(
      {
        date: reminderDate,
        recipients: groups.length,
        sent,
        skipped,
        failed,
      },
      { status: failed ? 207 : 200 },
    )
  }),
}
