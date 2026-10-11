import { DEBT_STATUS, type Debt, type DebtStatus } from '../types/debt'

export const REOPEN_WINDOW_MS = 30 * 60 * 1000

const emailOf = (value: string) => value.trim().toLowerCase()

export const isDebtCreditor = (debt: Debt, email: string) =>
  emailOf(debt.creditorEmail) === emailOf(email)

export const isDebtDebtor = (debt: Debt, email: string) =>
  emailOf(debt.debtorEmail) === emailOf(email)

export const closedWithinReopenWindow = (debt: Debt, now = Date.now()) => {
  if (!debt.closedAt) return false
  const closedAt = new Date(debt.closedAt).getTime()
  if (Number.isNaN(closedAt)) return false
  const age = now - closedAt
  return age >= 0 && age <= REOPEN_WINDOW_MS
}

type Permission = { ok: true } | { ok: false; message: string }

export const canRequestDebtClose = (debt: Debt, email: string): Permission => {
  if (!isDebtDebtor(debt, email)) {
    return {
      ok: false,
      message: 'Only the person who will give can ask to close this.',
    }
  }

  if (debt.status !== DEBT_STATUS.OPEN) {
    return { ok: false, message: 'Only an open debt can be sent for close.' }
  }

  return { ok: true }
}

export const canChangeDebtStatus = (
  debt: Debt,
  next: DebtStatus,
  email: string,
  isAdmin: boolean,
  now = Date.now(),
): Permission => {
  if (isAdmin) return { ok: true }

  if (next === DEBT_STATUS.CLOSED) {
    if (!isDebtCreditor(debt, email)) {
      return {
        ok: false,
        message: 'Only the person who will receive can close this.',
      }
    }

    if (
      debt.status !== DEBT_STATUS.OPEN &&
      debt.status !== DEBT_STATUS.CLOSE_REQUESTED
    ) {
      return { ok: false, message: 'This debt is already closed.' }
    }

    return { ok: true }
  }

  if (next === DEBT_STATUS.OPEN) {
    if (!isDebtCreditor(debt, email) || debt.status !== DEBT_STATUS.CLOSED) {
      return {
        ok: false,
        message: 'Only the person who received this can put it back.',
      }
    }

    if (!closedWithinReopenWindow(debt, now)) {
      return {
        ok: false,
        message: 'This can only be put back within 30 minutes of closing.',
      }
    }

    return { ok: true }
  }

  return { ok: false, message: 'You cannot change this debt.' }
}
