export type ExpenseSheetItem = {
  rowIndex: number
  name: string
  shares: Record<string, number>
  total: number
  price: number
  paidBy: string
  comments: string
}

export type ExpenseSheetSummary = {
  total: Record<string, number>
  grandTotal: number
  totalPrice: number
  given: Record<string, number>
  givenTotal: number
  pending: Record<string, number>
  pendingTotal: number
}

export type ExpenseSheetData = {
  id: string
  name: string
  users: string[]
  items: ExpenseSheetItem[]
  summary: ExpenseSheetSummary
}

export type ExpenseSheetDraftItem = {
  clientId: string
  rowIndex: number | null
  name: string
  shares: Record<string, number>
  paidBy: string
  comments: string
}

export type ExpenseSheetUpdateInput = {
  users: string[]
  items: ExpenseSheetDraftItem[]
  given: Record<string, number>
}

export type ExpenseSheetSavePayload = {
  users: string[]
  items: Array<{
    name: string
    shares: Record<string, number>
    paidBy: string
    comments: string
  }>
  given: Record<string, number>
}
