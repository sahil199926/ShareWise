export const DEBT_STATUS = {
  OPEN: 'open',
  CLOSE_REQUESTED: 'close_requested',
  CLOSED: 'closed',
} as const

export type DebtStatus = (typeof DEBT_STATUS)[keyof typeof DEBT_STATUS]

export type Debt = {
  id: string
  groupId: string
  debtorId: string
  debtorEmail: string
  debtorName: string
  creditorId: string
  creditorEmail: string
  creditorName: string
  amount: number
  note: string
  expenseDate: string | null
  batchId: string | null
  status: DebtStatus
  createdByEmail: string
  createdByName: string
  requestedByEmail: string | null
  requestedAt: string | null
  closedByEmail: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

export type DebtInput = {
  debtorId: string
  creditorId: string
  amount: number
  note: string
}

export type DebtRow = {
  id: string
  group_id: string
  debtor_id: string
  debtor_email: string
  debtor_name: string
  creditor_id: string
  creditor_email: string
  creditor_name: string
  amount: number | string
  note: string | null
  expense_date: string | null
  batch_id: string | null
  status: DebtStatus
  created_by_email: string
  created_by_name: string
  requested_by_email: string | null
  requested_at: string | null
  closed_by_email: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}
