import { callSheetApi } from '../lib/sheets-api'
import type { User } from '../types/auth'
import type { ProfileUpdateInput } from '../types/profile'

type ProfileResult = {
  user: User
}

export const getProfile = async (email: string) => {
  const response = await callSheetApi<ProfileResult>('getProfile', { email })

  if (!response.success || !response.user) {
    throw new Error(response.message ?? 'Failed to load profile')
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
    throw new Error(response.message ?? 'Failed to update profile')
  }

  return response.user
}
