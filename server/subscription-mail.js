const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const planName = (id) =>
  ({ basic: 'Basic', advanced: 'Advanced', pro: 'Pro' })[id] || 'Paid'

export const cancellationMail = (
  user,
  subscription,
  deletedDebts,
  cancelledAt = new Date(),
) => {
  const name = String(user.name || 'there').trim()
  const plan = planName(subscription.plan_id)
  const when = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(cancelledAt)
  const deleted = Number(deletedDebts) || 0
  const deletedLine =
    deleted > 0
      ? `${deleted.toLocaleString('en-IN')} older shared debt ${deleted === 1 ? 'record was' : 'records were'} permanently deleted from groups controlled by your plan.`
      : 'No shared debt records were deleted during this change.'
  const renewalLine =
    subscription.payment_provider === 'razorpay'
      ? 'Your Razorpay subscription was cancelled immediately and will not renew.'
      : 'This plan has ended. No Razorpay renewal was linked to it.'

  return {
    to: user.email,
    idempotencyKey: `subscription-cancelled/${subscription.id}`,
    subject: `Your Karja Tracker ${plan} subscription was cancelled`,
    text: `Hi ${name},\n\nYour ${plan} subscription was cancelled on ${when}. Your account moved to the Free plan immediately.\n\n${renewalLine}\n\n${deletedLine} Free plan limits now apply, including one month of expense history and 30 new debts per month. New debt creation may be blocked if a Free limit has already been reached.\n\nUnused paid time is not credited automatically. You can review your plan at https://dashboard.karja-tracker.com/profile#plans.\n\nKarja Tracker`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f7fcf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#14532d"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #dcfce7;border-radius:24px"><tr><td style="padding:28px 32px 8px;font-size:15px;font-weight:800">₹ &nbsp;Karja Tracker</td></tr><tr><td style="padding:12px 32px 0;color:#4d7c5f;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">Subscription update</td></tr><tr><td style="padding:8px 32px 0;font-size:26px;font-weight:800">Your ${escapeHtml(plan)} plan was cancelled</td></tr><tr><td style="padding:14px 32px 0;font-size:14px;line-height:22px">Hi ${escapeHtml(name)}, your subscription was cancelled on ${escapeHtml(when)}. Your account moved to Free immediately.</td></tr><tr><td style="padding:14px 32px 0;font-size:14px;line-height:22px">${escapeHtml(renewalLine)}</td></tr><tr><td style="padding:14px 32px 0;font-size:14px;line-height:22px">${escapeHtml(deletedLine)} Free limits now apply: one month of history and 30 new debts per month. New debt creation may be blocked if a limit has been reached.</td></tr><tr><td style="padding:18px 32px 0"><a href="https://dashboard.karja-tracker.com/profile#plans" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;border-radius:999px;padding:12px 20px;font-weight:700">View my plan</a></td></tr><tr><td style="padding:18px 32px 30px;color:#4d7c5f;font-size:12px;line-height:19px">Unused paid time is not credited automatically.</td></tr></table></td></tr></table></body></html>`,
  }
}
