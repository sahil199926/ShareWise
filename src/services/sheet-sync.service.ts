import { supabase } from '../lib/supabase'
import { getFirebaseAccessToken } from '../lib/firebase'
import { getDebt } from './debts.service'
import type {
  SheetAlias,
  SheetImportReceipt,
  SheetListResult,
  SheetSyncPreview,
  SheetSyncSubmission,
} from '../types/sheet-sync'

const requestSheetApi = async <T>(payload: Record<string, unknown>) => {
  const accessToken = await getFirebaseAccessToken()
  if (!accessToken) throw new Error('Sign in before syncing a sheet.')
  const response = await fetch('/api/sheet-sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
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
  groupId: string,
  page: number,
  search: string,
) =>
  requestSheetApi<SheetListResult>({
    action: 'listSheets',
    groupId,
    page,
    pageSize: 5,
    search,
  })

export const previewExpenseSheet = (groupId: string, sheetId: string) =>
  requestSheetApi<SheetSyncPreview>({
    action: 'previewSheet',
    groupId,
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
  groupId: string,
  spreadsheetId: string,
) => {
  const { data, error } = await supabase.rpc(
    'list_group_sheet_person_aliases',
    {
      p_group_id: groupId,
      p_spreadsheet_id: spreadsheetId,
    },
  )
  if (error) throw new Error(databaseError(error.message))
  return (data ?? []) as SheetAlias[]
}

export const listSheetImports = async (groupId: string) => {
  const { data, error } = await supabase.rpc('list_group_sheet_sync_imports', {
    p_group_id: groupId,
  })
  if (error) throw new Error(databaseError(error.message))
  return (data ?? []) as SheetImportReceipt[]
}

export const createSheetImportDebts = async (
  groupId: string,
  input: SheetSyncSubmission,
) => {
  const { data, error } = await supabase.rpc(
    'create_group_sheet_import_debts',
    {
      p_group_id: groupId,
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
    },
  )

  if (error || !Array.isArray(data)) {
    throw new Error(databaseError(error?.message))
  }

  return Promise.all(
    (data as string[]).map(async (id) => {
      const debt = await getDebt(groupId, id)
      if (!debt) throw new Error('A synced debt could not be loaded.')
      return debt
    }),
  )
}
