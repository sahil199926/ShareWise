import type { Debt } from '../types/debt'

type MailKind = 'debt_created' | 'payment_requested' | 'debt_closed'

export const notifyDebtMail = async (kind: MailKind, debt: Debt) => {
  try {
    const response = await fetch('/api/notify-debt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        appUrl: window.location.origin,
        debt: {
          id: debt.id,
          debtorName: debt.debtorName,
          debtorEmail: debt.debtorEmail,
          creditorName: debt.creditorName,
          creditorEmail: debt.creditorEmail,
          amount: debt.amount,
          note: debt.note,
        },
      }),
    })
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string
    }

    if (!response.ok) {
      return {
        sent: false,
        message: payload.error || 'The email could not be sent.',
      }
    }

    return { sent: true, message: '' }
  } catch {
    return { sent: false, message: 'The email could not be sent.' }
  }
}
