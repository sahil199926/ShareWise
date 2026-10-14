import type { ExpenseDebtProposal } from './expense'

export type SheetSyncIssue = {
  code: string
  message: string
  severity: 'error' | 'warning'
}

export type SheetSummary = {
  sheetId: string
  title: string
  rowCount: number
  columnCount: number
}

export type SheetListResult = {
  sheets: SheetSummary[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export type SheetPersonBalance = {
  rawName: string
  total: number
  given: number
  pending: number
  requiresReview: boolean
}

export type SheetSyncPreview = {
  spreadsheetId: string
  sheetId: string
  sheetTitle: string
  fingerprint: string
  people: SheetPersonBalance[]
  issues: SheetSyncIssue[]
  totals: {
    total: number
    given: number
    pending: number
    price: number | null
  }
}

export type SheetAlias = {
  alias: string
  userId: string
}

export type SheetImportReceipt = {
  sheetId: string
  sheetTitle: string
  fingerprint: string
  importedAt: string
}

export type SheetSyncSubmission = {
  spreadsheetId: string
  sheetId: string
  sheetTitle: string
  fingerprint: string
  note: string
  expenseDate: string
  debts: ExpenseDebtProposal[]
  aliases: SheetAlias[]
}
