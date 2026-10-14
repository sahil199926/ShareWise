import { supabase } from '../lib/supabase'
import {
  canChangeDebtStatus,
  canRequestDebtClose,
  isDebtCreditor,
  REOPEN_WINDOW_MS,
} from '../lib/debt-permissions'
import { mapDebtRow } from '../lib/debt-utils'
import {
  DEBT_STATUS,
  type Debt,
  type DebtInput,
  type DebtRow,
} from '../types/debt'
import type { User } from '../types/auth'
import type { ExpenseSubmission } from '../types/expense'

const TABLE = 'debts'

const toDebtError = (message: string | undefined, fallback: string) => {
  if (
    message?.includes('public.debts') ||
    message?.includes('list_debt_details') ||
    message?.includes('get_debt_detail') ||
    message?.includes('schema cache')
  ) {
    return 'Debts need a database update. Open the SQL editor and run supabase/schema.sql, then try again.'
  }

  return message || fallback
}

const loadDebts = async (): Promise<Debt[]> => {
  const { data, error } = await supabase.rpc('list_debt_details')

  if (error) {
    throw new Error(toDebtError(error.message, 'Failed to load debts'))
  }

  return ((data ?? []) as DebtRow[]).map(mapDebtRow)
}

export const listDebts = loadDebts

export const getDebt = async (id: string) => {
  const { data, error } = await supabase.rpc('get_debt_detail', { p_id: id })

  if (error) {
    if (error.message.includes('uuid')) return null
    throw new Error(toDebtError(error.message, 'Failed to load this debt'))
  }

  return data ? mapDebtRow(data as DebtRow) : null
}

const readSavedDebt = async (id: string) => {
  const debt = await getDebt(id)
  if (!debt) throw new Error('This debt was not found.')
  return debt
}

export const confirmDebtPayment = async (debt: Debt, user: User) => {
  if (!isDebtCreditor(debt, user.email)) {
    throw new Error('Only the person who will receive this can confirm it.')
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: DEBT_STATUS.CLOSED,
      closed_by_email: user.email.trim().toLowerCase(),
      closed_at: new Date().toISOString(),
    })
    .eq('id', debt.id)
    .eq('status', DEBT_STATUS.CLOSE_REQUESTED)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    throw new Error(
      toDebtError(
        error?.message,
        'This payment is not waiting to be confirmed.',
      ),
    )
  }

  return readSavedDebt(debt.id)
}

export const createDebt = async (admin: User, input: DebtInput) => {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      debtor_id: input.debtorId,
      creditor_id: input.creditorId,
      amount: input.amount,
      note: input.note.trim(),
      status: DEBT_STATUS.OPEN,
      created_by_email: admin.email.trim().toLowerCase(),
      created_by_name: admin.name.trim(),
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(toDebtError(error?.message, 'Failed to add debt'))
  }

  return readSavedDebt(data.id)
}

export const createExpenseDebts = async (
  admin: User,
  input: ExpenseSubmission,
) => {
  if (!input.debts.length) return []

  const batchId = crypto.randomUUID()
  const rows = input.debts.map((debt) => ({
    debtor_id: debt.debtorId,
    creditor_id: debt.creditorId,
    amount: debt.amount,
    note: input.note.trim(),
    expense_date: input.expenseDate,
    batch_id: batchId,
    status: DEBT_STATUS.OPEN,
    created_by_email: admin.email.trim().toLowerCase(),
    created_by_name: admin.name.trim(),
  }))

  const { data, error } = await supabase.from(TABLE).insert(rows).select('id')

  if (error || !data || data.length !== rows.length) {
    throw new Error(
      toDebtError(error?.message, 'Failed to create all expense debts'),
    )
  }

  return Promise.all(data.map((row) => readSavedDebt(row.id)))
}

export const updateDebt = async (id: string, input: DebtInput) => {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      debtor_id: input.debtorId,
      creditor_id: input.creditorId,
      amount: input.amount,
      note: input.note.trim(),
    })
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    throw new Error(toDebtError(error?.message, 'Failed to update debt'))
  }

  return readSavedDebt(id)
}

export const requestDebtClose = async (debt: Debt, user: User) => {
  const permission = canRequestDebtClose(debt, user.email)
  if (!permission.ok) throw new Error(permission.message)

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: DEBT_STATUS.CLOSE_REQUESTED,
      requested_by_email: user.email.trim().toLowerCase(),
      requested_at: new Date().toISOString(),
    })
    .eq('id', debt.id)
    .eq('status', DEBT_STATUS.OPEN)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    throw new Error(toDebtError(error?.message, 'Failed to request close'))
  }

  return readSavedDebt(debt.id)
}

export const setDebtStatus = async (
  debtId: string,
  status: Debt['status'],
  user: User,
  isAdmin = false,
) => {
  const current = await getDebt(debtId)
  if (!current) throw new Error('This debt was not found.')

  const permission = canChangeDebtStatus(current, status, user.email, isAdmin)
  if (!permission.ok) throw new Error(permission.message)

  const payload: Record<string, unknown> = { status }

  if (status === DEBT_STATUS.CLOSED) {
    payload.closed_by_email = user.email.trim().toLowerCase()
    payload.closed_at = new Date().toISOString()
  } else {
    payload.closed_by_email = null
    payload.closed_at = null
  }

  if (status === DEBT_STATUS.OPEN) {
    payload.requested_by_email = null
    payload.requested_at = null
  }

  let query = supabase.from(TABLE).update(payload).eq('id', debtId)

  if (status === DEBT_STATUS.CLOSED) {
    query = query.in('status', [DEBT_STATUS.OPEN, DEBT_STATUS.CLOSE_REQUESTED])
  } else if (status === DEBT_STATUS.OPEN && !isAdmin) {
    query = query
      .eq('status', DEBT_STATUS.CLOSED)
      .gte('closed_at', new Date(Date.now() - REOPEN_WINDOW_MS).toISOString())
  }

  const { data, error } = await query.select('id').maybeSingle()

  if (error || !data) {
    throw new Error(toDebtError(error?.message, 'Failed to update status'))
  }

  return readSavedDebt(debtId)
}

export const deleteDebt = async (id: string) => {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)

  if (error) {
    throw new Error(toDebtError(error.message, 'Failed to delete debt'))
  }
}
