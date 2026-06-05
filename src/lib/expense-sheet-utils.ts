import type {
  ExpenseSheetData,
  ExpenseSheetDraftItem,
  ExpenseSheetSavePayload,
  ExpenseSheetSummary,
  ExpenseSheetUpdateInput,
} from '../types/expense-sheet'

export const formatAmount = (value: number) => {
  if (value === 0) return '0'

  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export const getPendingTone = (value: number) => {
  if (value < 0) return 'credit'
  if (value > 0) return 'debit'
  return 'zero'
}

export const createClientId = () => {
  return crypto.randomUUID()
}

export const toExpenseSheetDraft = (
  data: ExpenseSheetData,
): ExpenseSheetUpdateInput => ({
  users: [...data.users],
  items: data.items.map((item) => ({
    clientId: String(item.rowIndex),
    rowIndex: item.rowIndex,
    name: item.name,
    shares: { ...item.shares },
    paidBy: item.paidBy,
    comments: item.comments,
  })),
  given: { ...data.summary.given },
})

export const toExpenseSheetSavePayload = (
  draft: ExpenseSheetUpdateInput,
): ExpenseSheetSavePayload => ({
  users: draft.users,
  given: draft.given,
  items: draft.items.map((item) => ({
    name: item.name.trim(),
    shares: item.shares,
    paidBy: item.paidBy,
    comments: item.comments,
  })),
})

export const computeLiveSummary = (
  users: string[],
  items: Array<Pick<ExpenseSheetDraftItem, 'shares'>>,
  given: Record<string, number>,
): ExpenseSheetSummary => {
  const total: Record<string, number> = {}

  users.forEach((user) => {
    total[user] = 0
  })

  let totalPrice = 0

  items.forEach((item) => {
    let rowTotal = 0

    users.forEach((user) => {
      const share = item.shares[user] || 0
      total[user] += share
      rowTotal += share
    })

    totalPrice += rowTotal
  })

  const grandTotal = users.reduce((sum, user) => sum + (total[user] || 0), 0)
  const givenTotal = users.reduce((sum, user) => sum + (given[user] || 0), 0)
  const pending: Record<string, number> = {}

  users.forEach((user) => {
    pending[user] = (total[user] || 0) - (given[user] || 0)
  })

  const pendingTotal = users.reduce(
    (sum, user) => sum + (pending[user] || 0),
    0,
  )

  return {
    total,
    grandTotal,
    totalPrice,
    given,
    givenTotal,
    pending,
    pendingTotal,
  }
}

export const addUserToDraft = (
  draft: ExpenseSheetUpdateInput,
  userName: string,
): ExpenseSheetUpdateInput => {
  if (draft.users.includes(userName)) return draft

  return {
    users: [...draft.users, userName],
    items: draft.items.map((item) => ({
      ...item,
      shares: { ...item.shares, [userName]: 0 },
    })),
    given: { ...draft.given, [userName]: 0 },
  }
}

export const removeUserFromDraft = (
  draft: ExpenseSheetUpdateInput,
  userName: string,
): ExpenseSheetUpdateInput => {
  if (draft.users.length <= 1) return draft

  const nextGiven = { ...draft.given }
  delete nextGiven[userName]

  return {
    users: draft.users.filter((user) => user !== userName),
    items: draft.items.map((item) => {
      const nextShares = { ...item.shares }
      delete nextShares[userName]

      return {
        ...item,
        shares: nextShares,
        paidBy: item.paidBy === userName ? '' : item.paidBy,
      }
    }),
    given: nextGiven,
  }
}

export const addItemToDraft = (
  draft: ExpenseSheetUpdateInput,
  name: string,
): ExpenseSheetUpdateInput => {
  const trimmed = name.trim() || `Item ${draft.items.length + 1}`

  return {
    ...draft,
    items: [
      ...draft.items,
      {
        clientId: createClientId(),
        rowIndex: null,
        name: trimmed,
        shares: Object.fromEntries(draft.users.map((user) => [user, 0])),
        paidBy: '',
        comments: '',
      },
    ],
  }
}

export const removeItemFromDraft = (
  draft: ExpenseSheetUpdateInput,
  clientId: string,
): ExpenseSheetUpdateInput => {
  if (draft.items.length <= 1) return draft

  return {
    ...draft,
    items: draft.items.filter((item) => item.clientId !== clientId),
  }
}
