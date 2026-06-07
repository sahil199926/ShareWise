import {
  PAYMENT_STATUS,
  type PaymentStatus,
} from '../constants/payment-status'
import type {
  ExpenseSheetData,
  ExpenseSheetDraftItem,
  ExpenseSheetSavePayload,
  ExpenseSheetSummary,
  ExpenseSheetUpdateInput,
} from '../types/expense-sheet'

export const createDefaultPaymentStatus = (
  users: string[],
): Record<string, PaymentStatus> => {
  return Object.fromEntries(
    users.map((user) => [user, PAYMENT_STATUS.NOT_PAID]),
  )
}

export const normalizePaymentStatusMap = (
  users: string[],
  paymentStatus: Record<string, PaymentStatus> | undefined,
): Record<string, PaymentStatus> => {
  const defaults = createDefaultPaymentStatus(users)

  if (!paymentStatus) return defaults

  users.forEach((user) => {
    if (paymentStatus[user]) {
      defaults[user] = paymentStatus[user]
    }
  })

  return defaults
}

export const formatAmount = (value: number) => {
  if (value === 0) return '0'

  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export const getPendingTone = (value: number) => {
  if (value < 0) return 'credit'
  if (value > 0) return 'debit'
  return 'zero'
}

export const formatPendingBalanceLabel = (pending: number) => {
  if (pending < 0) {
    return `Gets ${formatAmount(Math.abs(pending))}`
  }

  if (pending > 0) {
    return `Will give ${formatAmount(pending)}`
  }

  return 'Settled'
}

export const createClientId = () => {
  return crypto.randomUUID()
}

export const parsePaidBy = (value: string): string[] => {
  if (!value.trim()) return []

  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

export const formatPaidBy = (payers: string[]) => {
  return payers.join(', ')
}

export const normalizePaidBy = (raw: string, users: string[]): string[] => {
  const lookup = Object.fromEntries(
    users.map((user) => [user.toLowerCase(), user]),
  )

  return parsePaidBy(raw)
    .map((payer) => lookup[payer.toLowerCase()])
    .filter((payer): payer is string => Boolean(payer))
}

export const computeGivenFromItems = (
  users: string[],
  items: Array<Pick<ExpenseSheetDraftItem, 'price' | 'paidBy'>>,
): Record<string, number> => {
  const given = Object.fromEntries(users.map((user) => [user, 0]))

  items.forEach((item) => {
    const payers = item.paidBy.filter((payer) => users.includes(payer))
    if (!payers.length || !item.price) return

    const share = item.price / payers.length

    payers.forEach((payer) => {
      given[payer] = (given[payer] || 0) + share
    })
  })

  return given
}

export const syncDraftGiven = (
  draft: ExpenseSheetUpdateInput,
): ExpenseSheetUpdateInput => ({
  ...draft,
  given: computeGivenFromItems(draft.users, draft.items),
})

export const toExpenseSheetDraft = (
  data: ExpenseSheetData,
): ExpenseSheetUpdateInput => {
  const items = data.items.map((item) => ({
    clientId: String(item.rowIndex),
    rowIndex: item.rowIndex,
    name: item.name,
    shares: { ...item.shares },
    price: item.price,
    paidBy: normalizePaidBy(item.paidBy, data.users),
    comments: item.comments,
  }))

  return {
    users: [...data.users],
    items,
    given: computeGivenFromItems(data.users, items),
    paymentStatus: normalizePaymentStatusMap(
      data.users,
      data.summary.paymentStatus,
    ),
  }
}

export const toExpenseSheetSavePayload = (
  draft: ExpenseSheetUpdateInput,
): ExpenseSheetSavePayload => {
  const given = computeGivenFromItems(draft.users, draft.items)

  return {
    users: draft.users,
    given,
    paymentStatus: draft.paymentStatus,
    items: draft.items.map((item) => ({
      name: item.name.trim(),
      shares: item.shares,
      price: item.price,
      paidBy: formatPaidBy(item.paidBy),
      comments: item.comments,
    })),
  }
}

export const computeLiveSummary = (
  users: string[],
  items: Array<Pick<ExpenseSheetDraftItem, 'shares' | 'price'>>,
  given: Record<string, number>,
  paymentStatus: Record<string, PaymentStatus>,
): ExpenseSheetSummary => {
  const total: Record<string, number> = {}

  users.forEach((user) => {
    total[user] = 0
  })

  items.forEach((item) => {
    users.forEach((user) => {
      total[user] += item.shares[user] || 0
    })
  })

  const grandTotal = users.reduce((sum, user) => sum + (total[user] || 0), 0)
  const totalPrice = items.reduce((sum, item) => sum + (item.price || 0), 0)
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
    paymentStatus: normalizePaymentStatusMap(users, paymentStatus),
  }
}

export const addUserToDraft = (
  draft: ExpenseSheetUpdateInput,
  userName: string,
): ExpenseSheetUpdateInput => {
  if (draft.users.includes(userName)) return draft

  return syncDraftGiven({
    users: [...draft.users, userName],
    items: draft.items.map((item) => ({
      ...item,
      shares: { ...item.shares, [userName]: 0 },
    })),
    given: { ...draft.given, [userName]: 0 },
    paymentStatus: {
      ...draft.paymentStatus,
      [userName]: PAYMENT_STATUS.NOT_PAID,
    },
  })
}

export const removeUserFromDraft = (
  draft: ExpenseSheetUpdateInput,
  userName: string,
): ExpenseSheetUpdateInput => {
  if (draft.users.length <= 1) return draft

  const nextGiven = { ...draft.given }
  delete nextGiven[userName]

  const nextPaymentStatus = { ...draft.paymentStatus }
  delete nextPaymentStatus[userName]

  return syncDraftGiven({
    users: draft.users.filter((user) => user !== userName),
    items: draft.items.map((item) => {
      const nextShares = { ...item.shares }
      delete nextShares[userName]

      return {
        ...item,
        shares: nextShares,
        paidBy: item.paidBy.filter((payer) => payer !== userName),
      }
    }),
    given: nextGiven,
    paymentStatus: nextPaymentStatus,
  })
}

export const addItemToDraft = (
  draft: ExpenseSheetUpdateInput,
  name: string,
): ExpenseSheetUpdateInput => {
  const trimmed = name.trim() || `Item ${draft.items.length + 1}`

  return syncDraftGiven({
    ...draft,
    items: [
      ...draft.items,
      {
        clientId: createClientId(),
        rowIndex: null,
        name: trimmed,
        shares: Object.fromEntries(draft.users.map((user) => [user, 0])),
        price: 0,
        paidBy: [],
        comments: '',
      },
    ],
  })
}

export const removeItemFromDraft = (
  draft: ExpenseSheetUpdateInput,
  clientId: string,
): ExpenseSheetUpdateInput => {
  if (draft.items.length <= 1) return draft

  return syncDraftGiven({
    ...draft,
    items: draft.items.filter((item) => item.clientId !== clientId),
  })
}
