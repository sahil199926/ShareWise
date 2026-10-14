export const EXPENSE_SPLIT_METHOD = {
  EQUAL: 'equal',
  PERCENTAGE: 'percentage',
  AMOUNT: 'amount',
} as const

export type ExpenseSplitMethod =
  (typeof EXPENSE_SPLIT_METHOD)[keyof typeof EXPENSE_SPLIT_METHOD]

export type ExpensePerson = {
  id: string
  name: string
  email: string
}

export type ExpenseDebtProposal = {
  debtorId: string
  debtorName: string
  debtorEmail: string
  creditorId: string
  creditorName: string
  creditorEmail: string
  amount: number
}

export type ExpenseCalculationInput = {
  total: string
  people: ExpensePerson[]
  paidAmounts: Record<string, string>
  splitMethod: ExpenseSplitMethod
  splitValues: Record<string, string>
}

export type ExpenseCalculation = {
  totalAmount: number
  paidAmounts: Record<string, number>
  owedAmounts: Record<string, number>
  debts: ExpenseDebtProposal[]
}

export type ExpenseSubmission = ExpenseCalculation & {
  note: string
  expenseDate: string
  splitMethod: ExpenseSplitMethod
}
