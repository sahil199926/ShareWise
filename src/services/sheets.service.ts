import { SHEETS_PAGE_SIZE } from '../constants/pagination'
import { callSheetApi } from '../lib/sheets-api'
import type {
  CreateSheetInput,
  MasterUserOption,
  SheetItem,
  SheetListResult,
} from '../types/sheet'

export const listSheets = async (page = 1, pageSize = SHEETS_PAGE_SIZE) => {
  const response = await callSheetApi<SheetListResult>('listSheets', {
    page,
    pageSize,
  })

  if (!response.success || !response.sheets || !response.pagination) {
    throw new Error(response.message ?? 'Failed to load sheets')
  }

  return {
    sheets: response.sheets,
    pagination: response.pagination,
  }
}

export const listMasterUserOptions = async (requesterEmail: string) => {
  const response = await callSheetApi<{ users: MasterUserOption[] }>(
    'listMasterUserOptions',
    { requesterEmail },
  )

  if (!response.success || !response.users) {
    throw new Error(response.message ?? 'Failed to load users')
  }

  return response.users
}

export const createSheet = async (
  requesterEmail: string,
  input: CreateSheetInput,
) => {
  const response = await callSheetApi<{ sheet: SheetItem }>('createSheet', {
    requesterEmail,
    name: input.name,
    users: input.users,
    items: input.items,
  })

  if (!response.success || !response.sheet) {
    throw new Error(response.message ?? 'Failed to create sheet')
  }

  return response.sheet
}
