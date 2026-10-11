import { supabase } from '../lib/supabase'
import {
  canChangeDebtStatus,
  canRequestDebtClose,
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

export const getDebt = async (id: string) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    if (error.message.includes('uuid')) return null
    throw new Error(toDebtError(error.message, 'Failed to load this debt'))
  }

  return data ? mapDebtRow(data as DebtRow) : null
}

export const confirmDebtPayment = async (debt: Debt) => {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      status: DEBT_STATUS.CLOSED,
      closed_by_email: debt.creditorEmail.trim().toLowerCase(),
      closed_at: new Date().toISOString(),
    })
    .eq('id', debt.id)
    .eq('status', DEBT_STATUS.CLOSE_REQUESTED)
    .select('*')
    .maybeSingle()

  if (error || !data) {
    throw new Error(
      toDebtError(
        error?.message,
        'This payment is not waiting to be confirmed.',
      ),
    )
  }

  return mapDebtRow(data as DebtRow)
}

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
    .select('*')
    .maybeSingle()

  if (error || !data) {
    throw new Error(toDebtError(error?.message, 'Failed to request close'))
  }

  return mapDebtRow(data as DebtRow)
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

  const { data, error } = await query.select('*').maybeSingle()

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
