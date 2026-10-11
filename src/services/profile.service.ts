import { supabase } from '../lib/supabase'
import type { User } from '../types/auth'
import type { ProfileUpdateInput } from '../types/profile'

const toUser = (value: unknown): User => {
  const user = value as Partial<User>

  if (!user?.email || !user.name) {
    throw new Error('Profile not found')
  }

  return {
    name: user.name,
    email: user.email,
    type: user.type ?? 'User',
    age: user.age ?? null,
    score: user.score ?? null,
  }
}

export const getProfile = async (email: string) => {
  const { data, error } = await supabase.rpc('get_profile', {
    p_email: email,
  })

  if (error || !data) {
    throw new Error(error?.message || 'Failed to load profile')
  }

  return toUser(data)
}

export const updateProfile = async (
  email: string,
  profile: ProfileUpdateInput,
) => {
  const { data, error } = await supabase.rpc('update_profile', {
    p_email: email,
    p_name: profile.name,
    p_age: profile.age,
  })

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update profile')
  }

  return toUser(data)
}
