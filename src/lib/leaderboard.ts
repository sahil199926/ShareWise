import { isOpenDebt } from './debt-utils'
import type { Debt } from '../types/debt'

export type BoardId = 'receivers' | 'contributors' | 'owed'

export type LeaderboardPerson = {
  email: string
  name: string
  openOwe: number
  openReceive: number
  closedPaid: number
  closedReceived: number
  openOweCount: number
  openReceiveCount: number
  closedPaidCount: number
  closedReceivedCount: number
}

export type RankedPerson = LeaderboardPerson & {
  amount: number
  count: number
}

export type DayStat = {
  key: string
  label: string
  owed: number
  received: number
}

export const DAY_RANGES = [30, 60, 90, 180] as const

export type DayRange = (typeof DAY_RANGES)[number]

const normalize = (email: string) => email.trim().toLowerCase()

const dayKey = (value: string) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

const dayLabel = (key: string) => {
  const [year, month, day] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(year, month - 1, day))
}

const emptyPerson = (email: string, name: string): LeaderboardPerson => ({
  email,
  name: name.trim() || email,
  openOwe: 0,
  openReceive: 0,
  closedPaid: 0,
  closedReceived: 0,
  openOweCount: 0,
  openReceiveCount: 0,
  closedPaidCount: 0,
  closedReceivedCount: 0,
})

export const buildLeaderboard = (debts: Debt[]) => {
  const people = new Map<string, LeaderboardPerson>()

  const touch = (email: string, name: string) => {
    const key = normalize(email)
    const current = people.get(key)
    if (current) {
      if (name.trim()) current.name = name.trim()
      return current
    }

    const created = emptyPerson(key, name)
    people.set(key, created)
    return created
  }

  debts.forEach((debt) => {
    const debtor = touch(debt.debtorEmail, debt.debtorName)
    const creditor = touch(debt.creditorEmail, debt.creditorName)

    if (isOpenDebt(debt)) {
      debtor.openOwe += debt.amount
      debtor.openOweCount += 1
      creditor.openReceive += debt.amount
      creditor.openReceiveCount += 1
      return
    }

    debtor.closedPaid += debt.amount
    debtor.closedPaidCount += 1
    creditor.closedReceived += debt.amount
    creditor.closedReceivedCount += 1
  })

  return [...people.values()]
}

const metric = (person: LeaderboardPerson, board: BoardId) => {
  if (board === 'receivers') {
    return { amount: person.openReceive, count: person.openReceiveCount }
  }
  if (board === 'contributors') {
    return { amount: person.closedPaid, count: person.closedPaidCount }
  }
  return { amount: person.openOwe, count: person.openOweCount }
}

export const rankBoard = (people: LeaderboardPerson[], board: BoardId) => {
  return people
    .map((person) => ({ ...person, ...metric(person, board) }))
    .filter((person) => person.amount > 0)
    .sort(
      (left, right) =>
        right.amount - left.amount || left.name.localeCompare(right.name),
    )
}

export const recentDayKeys = (dayCount: number) => {
  const keys: string[] = []

  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const date = new Date()
    date.setUTCHours(12, 0, 0, 0)
    date.setUTCDate(date.getUTCDate() - offset)
    keys.push(dayKey(date.toISOString()))
  }

  return keys
}

export const filterDebtsByDays = (debts: Debt[], dayCount: number) => {
  const allowed = new Set(recentDayKeys(dayCount))
  return debts.filter((debt) => allowed.has(dayKey(debt.createdAt)))
}

export const recentDayStats = (
  debts: Debt[],
  email: string,
  dayCount: number,
): DayStat[] => {
  const self = normalize(email)
  const keys = recentDayKeys(dayCount)

  const allowed = new Set(keys)
  const rows = new Map<string, DayStat>(
    keys.map((key) => [
      key,
      { key, label: dayLabel(key), owed: 0, received: 0 },
    ]),
  )

  debts.forEach((debt) => {
    const key = dayKey(debt.createdAt)
    if (!allowed.has(key)) return

    const row = rows.get(key)
    if (!row) return

    if (normalize(debt.debtorEmail) === self) row.owed += debt.amount
    if (normalize(debt.creditorEmail) === self) row.received += debt.amount
  })

  return keys.map((key) => rows.get(key)!)
}
