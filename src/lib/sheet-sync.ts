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

export const initialSheetMappings = (
  people: SheetPersonBalance[],
  users: MasterUserOption[],
  aliases: SheetAlias[],
) => {
  const mappings: Record<string, string> = {}
  const aliasMap = new Map(
    aliases.map((alias) => [normalizeSheetPerson(alias.alias), alias.userId]),
  )
  const usersByName = new Map<string, MasterUserOption[]>()

  users.forEach((user) => {
    if (!user.id) return
    const key = normalizeSheetPerson(user.name)
    usersByName.set(key, [...(usersByName.get(key) ?? []), user])
  })

  people.forEach((person) => {
    const key = normalizeSheetPerson(person.rawName)
    const aliased = aliasMap.get(key)
    if (aliased && users.some((user) => user.id === aliased)) {
      mappings[person.rawName] = aliased
      return
    }

    const exact = usersByName.get(key) ?? []
    if (exact.length === 1 && exact[0].id) {
      mappings[person.rawName] = exact[0].id
    }
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
