import {
  DEBT_STATUS,
  type Debt,
  type DebtRow,
  type DebtStatus,
} from '../types/debt'

export const isDebtStatus = (value: string): value is DebtStatus => {
  return Object.values(DEBT_STATUS).includes(value as DebtStatus)
}

export const mapDebtRow = (row: DebtRow): Debt => {
  return {
    id: row.id,
    debtorId: row.debtor_id,
    debtorEmail: row.debtor_email,
    debtorName: row.debtor_name,
    creditorId: row.creditor_id,
    creditorEmail: row.creditor_email,
    creditorName: row.creditor_name,
    amount: Number(row.amount),
    note: row.note ?? '',
    expenseDate: row.expense_date,
    batchId: row.batch_id,
    status: isDebtStatus(row.status) ? row.status : DEBT_STATUS.OPEN,
    createdByEmail: row.created_by_email,
    createdByName: row.created_by_name,
    requestedByEmail: row.requested_by_email,
    requestedAt: row.requested_at,
    closedByEmail: row.closed_by_email,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const formatRupee = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)
}

export const formatDebtDate = (value: string | null) => {
  if (!value) return ''

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(
    new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value),
  )
}

export const debtActivityDate = (debt: Debt) =>
  debt.expenseDate ?? debt.createdAt

export const isOpenDebt = (debt: Debt) => debt.status !== DEBT_STATUS.CLOSED

export const debtInvolvesEmail = (debt: Debt, email: string) => {
  const normalized = email.trim().toLowerCase()
  return (
    debt.debtorEmail.trim().toLowerCase() === normalized ||
    debt.creditorEmail.trim().toLowerCase() === normalized
  )
}

export const sumOpenAmount = (
  debts: Debt[],
  email: string,
  role: 'debtor' | 'creditor',
) => {
  const normalized = email.trim().toLowerCase()

  return debts
    .filter((debt) => isOpenDebt(debt))
    .filter((debt) => {
      const target = role === 'debtor' ? debt.debtorEmail : debt.creditorEmail
      return target.trim().toLowerCase() === normalized
    })
    .reduce((total, debt) => total + debt.amount, 0)
}

export const getOpenDebtTotals = (debts: Debt[], email: string) => {
  const toGive = sumOpenAmount(debts, email, 'debtor')
  const toReceive = sumOpenAmount(debts, email, 'creditor')

  return {
    toGive,
    toReceive,
    net: toGive - toReceive,
  }
}

type DebtShareTextInput = {
  debts: Debt[]
  email: string
  name: string
  url: string
}

export const buildDebtShareText = ({
  debts,
  email,
  name,
  url,
}: DebtShareTextInput) => {
  const { toGive, toReceive, net } = getOpenDebtTotals(debts, email)
  const netLine =
    net > 0
      ? `Net amount to give: ${formatRupee(net)}`
      : net < 0
        ? `Net amount to receive: ${formatRupee(Math.abs(net))}`
        : 'Net balance: Settled'

  return [
    `${name}'s open Karja summary`,
    `Total to give: ${formatRupee(toGive)}`,
    `Total to receive: ${formatRupee(toReceive)}`,
    netLine,
    '',
    `View details: ${url}`,
  ].join('\n')
}
