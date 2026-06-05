import { callSheetApi, formatSheetApiError } from '../lib/sheets-api'
import type {
  ExpenseSheetData,
  ExpenseSheetSavePayload,
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
    throw new Error(formatSheetApiError(response.message, 'getExpenseSheet'))
  }

  return response.sheet
}

export const getSharedExpenseSheet = async (
  sheetId: string,
  requesterEmail?: string,
) => {
  const response = await callSheetApi<{ sheet: ExpenseSheetData }>(
    'getSharedExpenseSheet',
    { sheetId },
  )

  if (!response.success || !response.sheet) {
    if (response.message === 'Unknown action' && requesterEmail) {
      return getExpenseSheet(sheetId, requesterEmail)
    }

    throw new Error(
      formatSheetApiError(response.message, 'getSharedExpenseSheet'),
    )
  }

  return response.sheet
}

export const updateExpenseSheet = async (
  sheetId: string,
  requesterEmail: string,
  payload: ExpenseSheetSavePayload,
) => {
  const response = await callSheetApi<{ sheet: ExpenseSheetData }>(
    'updateExpenseSheet',
    { sheetId, requesterEmail, payload },
  )

  if (!response.success || !response.sheet) {
    throw new Error(formatSheetApiError(response.message, 'updateExpenseSheet'))
  }

  return response.sheet
}

export const requestPaymentStatus = async (
  sheetId: string,
  requesterEmail: string,
) => {
  const response = await callSheetApi<{ sheet: ExpenseSheetData }>(
    'requestPaymentStatus',
    { sheetId, requesterEmail },
  )

  if (!response.success || !response.sheet) {
    throw new Error(
      formatSheetApiError(response.message, 'requestPaymentStatus'),
    )
  }

  return response.sheet
}

export const confirmPaymentStatus = async (
  sheetId: string,
  requesterEmail: string,
  targetUser: string,
) => {
  const response = await callSheetApi<{ sheet: ExpenseSheetData }>(
    'confirmPaymentStatus',
    { sheetId, requesterEmail, targetUser },
  )

  if (!response.success || !response.sheet) {
    throw new Error(
      formatSheetApiError(response.message, 'confirmPaymentStatus'),
    )
  }

  return response.sheet
}
