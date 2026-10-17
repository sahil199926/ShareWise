export const sendMail = async (env, message) => {
  const apiKey = env.RESEND_API_KEY?.trim() ?? ''
  const from = env.MAIL_FROM?.trim() ?? ''

  if (!apiKey || !from) {
    return { sent: false, reason: 'missing-config' }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(message.idempotencyKey
        ? { 'Idempotency-Key': message.idempotencyKey }
        : {}),
    },
    body: JSON.stringify({
      from: `Karja Tracker <${from}>`,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  })

  if (response.ok) return { sent: true }

  const payload = await response.json().catch(() => ({}))
  const detail = String(payload?.message ?? '')

  if (/domain|verif/i.test(detail)) {
    return {
      sent: false,
      reason: 'domain',
      message:
        'eonlint.com is not verified for mail yet. In Resend, add the domain and the DNS records it shows.',
    }
  }

  return {
    sent: false,
    reason: 'provider',
    message: 'The email could not be sent.',
  }
}
