import { supabase } from '../lib/supabase'
import { mapDebtRow } from '../lib/debt-utils'
import type { PaginationMeta } from '../types/pagination'
import {
  DEBT_STATUS,
  type Debt,
  type DebtInput,
  type DebtRow,
} from '../types/debt'
import type { ExpenseSubmission } from '../types/expense'

type DebtPage = { debts: Debt[]; pagination: PaginationMeta }
type DebtFilters = {
  page?: number
  pageSize?: number
  status?: Debt['status'] | null
  personId?: string | null
  days?: number | null
}

const explain = (message: string | undefined, fallback: string) => {
  if (
    message?.includes('list_group_debts') ||
    message?.includes('get_group_debt') ||
    message?.includes('schema cache')
  )
    return 'The secure group database migration has not been applied yet.'
  return message || fallback
}

export const listDebtPage = async (
  groupId: string,
  filters: DebtFilters = {},
): Promise<DebtPage> => {
  const { data, error } = await supabase.rpc('list_group_debts', {
    p_group_id: groupId,
    p_page: filters.page ?? 1,
    p_page_size: filters.pageSize ?? 20,
    p_status: filters.status ?? null,
    p_person_id: filters.personId ?? null,
    p_days: filters.days ?? null,
  })
  if (error || !data)
    throw new Error(explain(error?.message, 'Failed to load debts'))
  const result = data as { debts?: DebtRow[]; pagination?: PaginationMeta }
  if (!result.debts || !result.pagination)
    throw new Error('Failed to load debts')
  return { debts: result.debts.map(mapDebtRow), pagination: result.pagination }
}

// Summary screens are capped. The debt list uses listDebtPage directly so its
// navigation and filters run inside Postgres instead of loading all history.
export const listDebts = async (groupId: string, days?: number | null) =>
  (await listDebtPage(groupId, { pageSize: 100, days })).debts

export const getDebt = async (groupId: string, id: string) => {
  const { data, error } = await supabase.rpc('get_group_debt', {
    p_group_id: groupId,
    p_id: id,
  })
  if (error) {
    if (error.message.includes('uuid')) return null
    throw new Error(explain(error.message, 'Failed to load this debt'))
  }
  return data ? mapDebtRow(data as DebtRow) : null
}

const readSavedDebt = async (groupId: string, id: string) => {
  const debt = await getDebt(groupId, id)
  if (!debt) throw new Error('This debt was not found.')
  return debt
}

export const createDebt = async (groupId: string, input: DebtInput) => {
  const { data, error } = await supabase.rpc('create_group_debt', {
    p_group_id: groupId,
    p_debtor_id: input.debtorId,
    p_creditor_id: input.creditorId,
    p_amount: input.amount,
    p_note: input.note.trim(),
    p_expense_date: null,
    p_batch_id: null,
  })
  if (error || !data)
    throw new Error(explain(error?.message, 'Failed to add debt'))
  return readSavedDebt(groupId, String(data))
}

export const createExpenseDebts = async (
  groupId: string,
  input: ExpenseSubmission,
) => {
  if (!input.debts.length) return []
  const { data, error } = await supabase.rpc('create_group_expense_debts', {
    p_group_id: groupId,
    p_note: input.note.trim(),
    p_expense_date: input.expenseDate,
    p_debts: input.debts,
  })
  if (error || !data)
    throw new Error(
      explain(error?.message, 'Failed to create all expense debts'),
    )
  return Promise.all((data as string[]).map((id) => readSavedDebt(groupId, id)))
}

export const updateDebt = async (
  groupId: string,
  id: string,
  input: DebtInput,
) => {
  const { error } = await supabase.rpc('update_group_debt', {
    p_group_id: groupId,
    p_id: id,
    p_debtor_id: input.debtorId,
    p_creditor_id: input.creditorId,
    p_amount: input.amount,
    p_note: input.note.trim(),
  })
  if (error) throw new Error(explain(error.message, 'Failed to update debt'))
  return readSavedDebt(groupId, id)
}

export const requestDebtClose = async (groupId: string, debtId: string) => {
  const { error } = await supabase.rpc('request_group_debt_close', {
    p_group_id: groupId,
    p_id: debtId,
  })
  if (error) throw new Error(explain(error.message, 'Failed to request close'))
  return readSavedDebt(groupId, debtId)
}

export const setDebtStatus = async (
  groupId: string,
  debtId: string,
  status: Debt['status'],
) => {
  const { error } = await supabase.rpc('set_group_debt_status', {
    p_group_id: groupId,
    p_id: debtId,
    p_status: status,
  })
  if (error) throw new Error(explain(error.message, 'Failed to update status'))
  return readSavedDebt(groupId, debtId)
}

export const confirmDebtPayment = async (groupId: string, debtId: string) =>
  setDebtStatus(groupId, debtId, DEBT_STATUS.CLOSED)

export const deleteDebt = async (groupId: string, id: string) => {
  const { error } = await supabase.rpc('delete_group_debt', {
    p_group_id: groupId,
    p_id: id,
  })
  if (error) throw new Error(explain(error.message, 'Failed to delete debt'))
}

export const createDebtShareToken = async (
  groupId: string,
  personUserId: string,
) => {
  const { data, error } = await supabase.rpc('create_debt_share_token', {
    p_group_id: groupId,
    p_person_user_id: personUserId,
    p_hours: 168,
  })
  if (error || !data)
    throw new Error(explain(error?.message, 'Failed to create share link'))
  return data as { token: string; expiresAt: string }
}

export const getSharedDebts = async (token: string) => {
  const { data, error } = await supabase.rpc('get_shared_debts', {
    p_token: token,
  })
  if (error || !data)
    throw new Error(error?.message || 'This share link is invalid or expired')
  const result = data as {
    person: { id: string; name: string; email: string }
    expiresAt: string
    debts: DebtRow[]
  }
  return { ...result, debts: result.debts.map(mapDebtRow) }
}
