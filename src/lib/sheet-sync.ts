import type { ExpenseDebtProposal, ExpensePerson } from '../types/expense'
import type {
  SheetAlias,
  SheetPersonBalance,
  SheetSyncPreview,
} from '../types/sheet-sync'
import type { MasterUserOption } from '../types/user-option'

export const normalizeSheetPerson = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9@]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

const normalizeEmail = (value: string) => value.trim().toLowerCase()

const EMAIL_PATTERN =
  /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/i

const extractEmail = (value: string) =>
  normalizeEmail(value.match(EMAIL_PATTERN)?.[0] ?? '')

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const uniqueUserId = (users: MasterUserOption[]) => {
  const ids = [...new Set(users.flatMap((user) => (user.id ? [user.id] : [])))]
  return ids.length === 1 ? ids[0] : undefined
}

const nameRegexFor = (value: string) => {
  const normalized = normalizeSheetPerson(value)
  if (!normalized || normalized.includes('@')) return null

  const tokens = normalized.split(' ').filter(Boolean)
  const compactLength = tokens.join('').length
  if (!tokens.length || compactLength < 3 || !/[a-z]/.test(normalized)) {
    return null
  }

  return new RegExp(
    `(?:^|\\s)${tokens
      .map((token) => `${escapeRegExp(token)}[a-z0-9]*`)
      .join('\\s+')}(?:\\s|$)`,
    'i',
  )
}

const emailRegexFor = (value: string) => {
  const normalized = normalizeSheetPerson(value)
  if (!normalized || normalized.includes('@')) return null

  const compact = normalized.replace(/[^a-z0-9]/g, '')
  if (compact.length < 4 || !/[a-z]/.test(compact)) return null

  return new RegExp(escapeRegExp(compact), 'i')
}

export const findSheetUserMatch = (
  sheetPerson: string,
  users: MasterUserOption[],
) => {
  const key = normalizeSheetPerson(sheetPerson)

  const exactName = uniqueUserId(
    users.filter((user) => normalizeSheetPerson(user.name) === key),
  )
  if (exactName) return exactName

  const sheetEmail = extractEmail(sheetPerson)
  if (sheetEmail) {
    const exactEmail = uniqueUserId(
      users.filter((user) => normalizeEmail(user.email) === sheetEmail),
    )
    if (exactEmail) return exactEmail
  }

  const nameRegex = nameRegexFor(sheetPerson)
  if (nameRegex) {
    const nameMatch = uniqueUserId(
      users.filter((user) => nameRegex.test(normalizeSheetPerson(user.name))),
    )
    if (nameMatch) return nameMatch
  }

  const emailRegex = emailRegexFor(sheetPerson)
  if (!emailRegex) return undefined

  return uniqueUserId(
    users.filter((user) => {
      const localPart = normalizeEmail(user.email).split('@')[0] ?? ''
      return emailRegex.test(localPart.replace(/[^a-z0-9]/g, ''))
    }),
  )
}

export const initialSheetMappings = (
  people: SheetPersonBalance[],
  users: MasterUserOption[],
  aliases: SheetAlias[],
) => {
  const mappings: Record<string, string> = {}
  const aliasMap = new Map(
    aliases.map((alias) => [normalizeSheetPerson(alias.alias), alias.userId]),
  )

  people.forEach((person) => {
    const key = normalizeSheetPerson(person.rawName)
    const aliased = aliasMap.get(key)
    if (aliased && users.some((user) => user.id === aliased)) {
      mappings[person.rawName] = aliased
      return
    }

    const matchedUserId = findSheetUserMatch(person.rawName, users)
    if (matchedUserId) mappings[person.rawName] = matchedUserId
  })

  return mappings
}

type RunningBalance = ExpensePerson & { paise: number; order: number }

export const buildSheetDebts = (
  preview: SheetSyncPreview,
  mappings: Record<string, string>,
  users: MasterUserOption[],
): ExpenseDebtProposal[] => {
  const usersById = new Map(
    users.flatMap((user) =>
      user.id
        ? [
            [
              user.id,
              { id: user.id, name: user.name, email: user.email },
            ] as const,
          ]
        : [],
    ),
  )
  const aggregated = new Map<string, RunningBalance>()

  preview.people.forEach((person, order) => {
    const paise = Math.round(person.pending * 100)
    if (!paise) return

    const userId = mappings[person.rawName]
    const user = usersById.get(userId)
    if (!user) throw new Error(`Match ${person.rawName} to a person first.`)

    const current = aggregated.get(userId)
    aggregated.set(userId, {
      ...user,
      paise: (current?.paise ?? 0) + paise,
      order: current?.order ?? order,
    })
  })

  const debtors = [...aggregated.values()]
    .filter((person) => person.paise > 0)
    .sort((a, b) => a.order - b.order)
  const creditors = [...aggregated.values()]
    .filter((person) => person.paise < 0)
    .map((person) => ({ ...person, paise: Math.abs(person.paise) }))
    .sort((a, b) => a.order - b.order)

  const owed = debtors.reduce((sum, person) => sum + person.paise, 0)
  const receivable = creditors.reduce((sum, person) => sum + person.paise, 0)
  if (owed !== receivable) {
    throw new Error('The mapped balances do not settle to ₹0.')
  }

  const debts: ExpenseDebtProposal[] = []
  let debtorIndex = 0
  let creditorIndex = 0

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex]
    const creditor = creditors[creditorIndex]
    const paise = Math.min(debtor.paise, creditor.paise)

    if (debtor.id !== creditor.id && paise > 0) {
      debts.push({
        debtorId: debtor.id,
        debtorName: debtor.name,
        debtorEmail: debtor.email,
        creditorId: creditor.id,
        creditorName: creditor.name,
        creditorEmail: creditor.email,
        amount: paise / 100,
      })
    }

    debtor.paise -= paise
    creditor.paise -= paise
    if (debtor.paise === 0) debtorIndex += 1
    if (creditor.paise === 0) creditorIndex += 1
  }

  return debts
}
