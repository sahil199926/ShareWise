import { callSheetApi, formatSheetApiError } from '../lib/sheets-api'
import type { User } from '../types/auth'

type LoginResult = {
  user: User
}

export const loginWithSheet = async (email: string, password: string) => {
  const response = await callSheetApi<LoginResult>('login', { email, password })

  if (!response.success || !response.user) {
    throw new Error(formatSheetApiError(response.message, 'login'))
  }

  return response.user
}
