import { callSheetApi } from '../lib/sheets-api'
import type {
  ExpenseSheetData,
  ExpenseSheetUpdateInput,
} from '../types/expense-sheet'

export const getExpenseSheet = async (
  sheetId: string,
  requesterEmail: string,
) => {
  const response = await callSheetApi<{ sheet: ExpenseSheetData }>(
    'getExpenseSheet',
    { sheetId, requesterEmail },
  )

  if (!response.success || !response.sheet) {
    throw new Error(response.message ?? 'Failed to load sheet')
  }

  return response.sheet
}

export const updateExpenseSheet = async (
  sheetId: string,
  requesterEmail: string,
  payload: ExpenseSheetUpdateInput,
) => {
  const response = await callSheetApi<{ sheet: ExpenseSheetData }>(
    'updateExpenseSheet',
    { sheetId, requesterEmail, payload },
  )

  if (!response.success || !response.sheet) {
    throw new Error(response.message ?? 'Failed to save sheet')
  }

  return response.sheet
}
