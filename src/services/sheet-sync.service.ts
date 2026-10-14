import { supabase } from '../lib/supabase'
import { getDebt } from './debts.service'
import type { User } from '../types/auth'
import type {
  SheetAlias,
  SheetImportReceipt,
  SheetListResult,
  SheetSyncPreview,
  SheetSyncSubmission,
} from '../types/sheet-sync'

const requestSheetApi = async <T>(payload: Record<string, unknown>) => {
  const response = await fetch('/api/sheet-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const result = (await response.json().catch(() => ({}))) as T & {
    error?: string
  }

  if (!response.ok) {
    throw new Error(result.error || 'Could not read the spreadsheet.')
  }
  return result
}

export const listExpenseSheets = (
  requesterEmail: string,
  page: number,
  search: string,
) =>
  requestSheetApi<SheetListResult>({
    action: 'listSheets',
    requesterEmail,
    page,
    pageSize: 20,
    search,
  })

export const previewExpenseSheet = (requesterEmail: string, sheetId: string) =>
  requestSheetApi<SheetSyncPreview>({
    action: 'previewSheet',
    requesterEmail,
    sheetId,
  })

const databaseError = (message: string | undefined) => {
  if (
    message?.includes('sheet_sync') ||
    message?.includes('schema cache') ||
    message?.includes('Could not find the function')
  ) {
    return 'Sheet sync needs a database update. Run supabase/schema.sql, then try again.'
  }
  return message || 'Sheet sync failed.'
}

export const listSheetAliases = async (
  requesterEmail: string,
  spreadsheetId: string,
) => {
  const { data, error } = await supabase.rpc('list_sheet_person_aliases', {
    p_requester_email: requesterEmail,
    p_spreadsheet_id: spreadsheetId,
  })
  if (error) throw new Error(databaseError(error.message))
  return (data ?? []) as SheetAlias[]
}

export const listSheetImports = async (requesterEmail: string) => {
  const { data, error } = await supabase.rpc('list_sheet_sync_imports', {
    p_requester_email: requesterEmail,
  })
  if (error) throw new Error(databaseError(error.message))
  return (data ?? []) as SheetImportReceipt[]
}

export const createSheetImportDebts = async (
  admin: User,
  input: SheetSyncSubmission,
) => {
  const { data, error } = await supabase.rpc('create_sheet_import_debts', {
    p_requester_email: admin.email,
    p_spreadsheet_id: input.spreadsheetId,
    p_sheet_id: input.sheetId,
    p_sheet_title: input.sheetTitle,
    p_fingerprint: input.fingerprint,
    p_note: input.note,
    p_expense_date: input.expenseDate,
    p_debts: input.debts.map((debt) => ({
      debtorId: debt.debtorId,
      creditorId: debt.creditorId,
      amount: debt.amount,
    })),
    p_aliases: input.aliases,
  })

  if (error || !Array.isArray(data)) {
    throw new Error(databaseError(error?.message))
  }

  return Promise.all(
    (data as string[]).map(async (id) => {
      const debt = await getDebt(id)
      if (!debt) throw new Error('A synced debt could not be loaded.')
      return debt
    }),
  )
}
