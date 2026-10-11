import { supabase } from '../lib/supabase'
import { mapDebtRow } from '../lib/debt-utils'
import { DEBT_STATUS, type Debt, type DebtInput, type DebtRow } from '../types/debt'
import type { User } from '../types/auth'

const TABLE = 'debts'

const toDebtError = (message: string | undefined, fallback: string) => {
  if (message?.includes('public.debts')) {
    return 'Debts table is missing in Supabase. Open the SQL editor and run supabase/schema.sql, then try again.'
  }

  return message || fallback
}

const loadDebts = async (): Promise<Debt[]> => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(toDebtError(error.message, 'Failed to load debts'))
  }

  return ((data ?? []) as DebtRow[]).map(mapDebtRow)
}

export const listDebts = loadDebts

export const createDebt = async (admin: User, input: DebtInput) => {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      debtor_email: input.debtorEmail.trim().toLowerCase(),
      debtor_name: input.debtorName.trim(),
      creditor_email: input.creditorEmail.trim().toLowerCase(),
      creditor_name: input.creditorName.trim(),
      amount: input.amount,
      note: input.note.trim(),
      status: DEBT_STATUS.OPEN,
      created_by_email: admin.email.trim().toLowerCase(),
      created_by_name: admin.name.trim(),
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(toDebtError(error?.message, 'Failed to add debt'))
  }

  return mapDebtRow(data as DebtRow)
}

export const updateDebt = async (id: string, input: DebtInput) => {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      debtor_email: input.debtorEmail.trim().toLowerCase(),
      debtor_name: input.debtorName.trim(),
      creditor_email: input.creditorEmail.trim().toLowerCase(),
      creditor_name: input.creditorName.trim(),
      amount: input.amount,
      note: input.note.trim(),
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(toDebtError(error?.message, 'Failed to update debt'))
  }

  return mapDebtRow(data as DebtRow)
}

export const requestDebtClose = async (debt: Debt, user: User) => {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: DEBT_STATUS.CLOSE_REQUESTED,
      requested_by_email: user.email.trim().toLowerCase(),
      requested_at: new Date().toISOString(),
    })
    .eq('id', debt.id)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(toDebtError(error?.message, 'Failed to request close'))
  }

  return mapDebtRow(data as DebtRow)
}

export const setDebtStatus = async (
  debtId: string,
  status: Debt['status'],
  admin: User,
) => {
  const payload: Record<string, unknown> = { status }

  if (status === DEBT_STATUS.CLOSED) {
    payload.closed_by_email = admin.email.trim().toLowerCase()
    payload.closed_at = new Date().toISOString()
  } else {
    payload.closed_by_email = null
    payload.closed_at = null
  }

  if (status === DEBT_STATUS.OPEN) {
    payload.requested_by_email = null
    payload.requested_at = null
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(payload)
    .eq('id', debtId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(toDebtError(error?.message, 'Failed to update status'))
  }

  return mapDebtRow(data as DebtRow)
}

export const deleteDebt = async (id: string) => {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)

  if (error) {
    throw new Error(toDebtError(error.message, 'Failed to delete debt'))
  }
}
