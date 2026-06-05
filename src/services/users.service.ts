import { SHEETS_PAGE_SIZE } from '../constants/pagination'
import { callSheetApi } from '../lib/sheets-api'
import type { MasterUser, MasterUserInput } from '../types/master-user'
import type { PaginationMeta } from '../types/sheet'

type UserListResult = {
  users: MasterUser[]
  pagination: PaginationMeta
}

export const listUsers = async (
  requesterEmail: string,
  page = 1,
  pageSize = SHEETS_PAGE_SIZE,
) => {
  const response = await callSheetApi<UserListResult>('listUsers', {
    requesterEmail,
    page,
    pageSize,
  })

  if (!response.success || !response.users || !response.pagination) {
    throw new Error(response.message ?? 'Failed to load users')
  }

  return {
    users: response.users,
    pagination: response.pagination,
  }
}

export const createUser = async (
  requesterEmail: string,
  user: MasterUserInput,
) => {
  const response = await callSheetApi<{ user: MasterUser }>('createUser', {
    requesterEmail,
    user,
  })

  if (!response.success || !response.user) {
    throw new Error(response.message ?? 'Failed to create user')
  }

  return response.user
}

export const updateUser = async (
  requesterEmail: string,
  rowId: number,
  user: MasterUserInput,
) => {
  const response = await callSheetApi<{ user: MasterUser }>('updateUser', {
    requesterEmail,
    rowId,
    user,
  })

  if (!response.success || !response.user) {
    throw new Error(response.message ?? 'Failed to update user')
  }

  return response.user
}

export const deleteUser = async (requesterEmail: string, rowId: number) => {
  const response = await callSheetApi('deleteUser', { requesterEmail, rowId })

  if (!response.success) {
    throw new Error(response.message ?? 'Failed to delete user')
  }
}
