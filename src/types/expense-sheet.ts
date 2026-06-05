import type { PaymentStatus } from '../constants/payment-status'

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
  paymentStatus: Record<string, PaymentStatus>
}

export type ExpenseSheetPermissions = {
  canEdit: boolean
  canManagePayments: boolean
}

export type ExpenseSheetData = {
  id: string
  name: string
  users: string[]
  items: ExpenseSheetItem[]
  summary: ExpenseSheetSummary
  ownerEmail: string
  ownerName: string
  permissions: ExpenseSheetPermissions
}

export type ExpenseSheetDraftItem = {
  clientId: string
  rowIndex: number | null
  name: string
  shares: Record<string, number>
  price: number
  paidBy: string[]
  comments: string
}

export type ExpenseSheetUpdateInput = {
  users: string[]
  items: ExpenseSheetDraftItem[]
  given: Record<string, number>
  paymentStatus: Record<string, PaymentStatus>
}

export type ExpenseSheetSavePayload = {
  users: string[]
  items: Array<{
    name: string
    shares: Record<string, number>
    price: number
    paidBy: string
    comments: string
  }>
  given: Record<string, number>
  paymentStatus: Record<string, PaymentStatus>
}
