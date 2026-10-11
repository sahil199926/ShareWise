import { DEBT_STATUS, type Debt, type DebtStatus } from '../types/debt'
import type { MasterUserOption } from '../types/user-option'
import { debtInvolvesEmail, isOpenDebt } from './debt-utils'

const normalize = (email: string) => email.trim().toLowerCase()

const dayKey = (value: string) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

const dayLabel = (value: string) => {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
  }).format(new Date(value))
}

export type CounterpartBar = {
  email: string
  name: string
  willGive: number
  willGet: number
}

export type StatusSlice = {
  status: DebtStatus
  label: string
  count: number
  amount: number
}

export type DayBar = {
  key: string
  label: string
  amount: number
  count: number
}

export const debtsForPerson = (debts: Debt[], email: string) => {
  return debts.filter((debt) => debtInvolvesEmail(debt, email))
}

export const buildCounterpartBars = (
  debts: Debt[],
  email: string,
): CounterpartBar[] => {
  const self = normalize(email)
  const rows = new Map<string, CounterpartBar>()

  debtsForPerson(debts, email)
    .filter(isOpenDebt)
    .forEach((debt) => {
      const debtor = normalize(debt.debtorEmail)
      const creditor = normalize(debt.creditorEmail)
      const otherEmail = debtor === self ? debt.creditorEmail : debt.debtorEmail
      const otherName = debtor === self ? debt.creditorName : debt.debtorName
      const key = normalize(otherEmail)
      const current = rows.get(key) ?? {
        email: otherEmail,
        name: otherName,
        willGive: 0,
        willGet: 0,
      }

      if (debtor === self) current.willGive += debt.amount
      if (creditor === self) current.willGet += debt.amount
      rows.set(key, current)
    })

  return [...rows.values()].sort(
    (left, right) =>
      right.willGive + right.willGet - (left.willGive + left.willGet),
  )
}

const STATUS_SLICES: Array<{ status: DebtStatus; label: string }> = [
  { status: DEBT_STATUS.OPEN, label: 'Open' },
  { status: DEBT_STATUS.CLOSE_REQUESTED, label: 'Waiting' },
  { status: DEBT_STATUS.CLOSED, label: 'Closed' },
]

export const buildStatusSlices = (
  debts: Debt[],
  email: string,
): StatusSlice[] => {
  const mine = debtsForPerson(debts, email)

  return STATUS_SLICES.map((slice) => {
    const matching = mine.filter((debt) => debt.status === slice.status)

    return {
      status: slice.status,
      label: slice.label,
      count: matching.length,
      amount: matching.reduce((total, debt) => total + debt.amount, 0),
    }
  })
}

export const buildDayBars = (debts: Debt[], email: string): DayBar[] => {
  const rows = new Map<string, DayBar>()

  debtsForPerson(debts, email).forEach((debt) => {
    const key = dayKey(debt.createdAt)
    const current = rows.get(key) ?? {
      key,
      label: dayLabel(debt.createdAt),
      amount: 0,
      count: 0,
    }

    current.amount += debt.amount
    current.count += 1
    rows.set(key, current)
  })

  return [...rows.values()].sort((left, right) =>
    left.key.localeCompare(right.key),
  )
}

export const mergePeople = (
  directory: MasterUserOption[],
  debts: Debt[],
): MasterUserOption[] => {
  const rows = new Map<string, MasterUserOption>()

  directory.forEach((person) => {
    rows.set(normalize(person.email), person)
  })

  debts.forEach((debt) => {
    const pairs = [
      { email: debt.debtorEmail, name: debt.debtorName },
      { email: debt.creditorEmail, name: debt.creditorName },
    ]

    pairs.forEach((person) => {
      const key = normalize(person.email)
      if (!rows.has(key)) rows.set(key, person)
    })
  })

  return [...rows.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  )
}
