import type { Debt } from '../types/debt'
import type { ExpenseSubmission } from '../types/expense'

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

export const notifyExpenseMail = async (
  expense: Pick<ExpenseSubmission, 'note' | 'expenseDate' | 'totalAmount'>,
  debts: Debt[],
) => {
  try {
    const response = await fetch('/api/notify-expense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appUrl: window.location.origin,
        expense,
        debts: debts.map((debt) => ({
          id: debt.id,
          debtorName: debt.debtorName,
          debtorEmail: debt.debtorEmail,
          creditorName: debt.creditorName,
          amount: debt.amount,
        })),
      }),
    })
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string
      sent?: number
    }

    if (!response.ok) {
      return {
        sent: false,
        count: payload.sent ?? 0,
        message: payload.error || 'The expense emails could not be sent.',
      }
    }

    return { sent: true, count: payload.sent ?? 0, message: '' }
  } catch {
    return {
      sent: false,
      count: 0,
      message: 'The expense emails could not be sent.',
    }
  }
}
