import type {
  ExpenseSheetData,
  ExpenseSheetItem,
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

export const toExpenseSheetDraft = (
  data: ExpenseSheetData,
): ExpenseSheetUpdateInput => ({
  items: data.items.map((item) => ({
    rowIndex: item.rowIndex,
    shares: { ...item.shares },
    paidBy: item.paidBy,
    comments: item.comments,
  })),
  given: { ...data.summary.given },
})

export const computeLiveSummary = (
  users: string[],
  items: Array<Pick<ExpenseSheetItem, 'shares'>>,
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

export const getDraftItemsForSummary = (
  data: ExpenseSheetData,
  draft: ExpenseSheetUpdateInput,
) => {
  return data.items.map((item) => {
    const draftItem = draft.items.find(
      (entry) => entry.rowIndex === item.rowIndex,
    )

    return {
      shares: draftItem?.shares ?? item.shares,
    }
  })
}
