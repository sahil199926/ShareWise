import { callSheetApi, formatSheetApiError } from '../lib/sheets-api'
import type { User } from '../types/auth'
import type { ProfileUpdateInput } from '../types/profile'

type ProfileResult = {
  user: User
}

export const getProfile = async (email: string) => {
  const response = await callSheetApi<ProfileResult>('getProfile', { email })

  if (!response.success || !response.user) {
    throw new Error(formatSheetApiError(response.message, 'getProfile'))
  }

  return response.user
}

export const updateProfile = async (
  email: string,
  profile: ProfileUpdateInput,
) => {
  const response = await callSheetApi<ProfileResult>('updateProfile', {
    email,
    profile,
  })

  if (!response.success || !response.user) {
    throw new Error(formatSheetApiError(response.message, 'updateProfile'))
  }

  return response.user
}
