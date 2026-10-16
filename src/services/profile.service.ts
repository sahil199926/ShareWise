import { supabase } from '../lib/supabase'
import type { User } from '../types/auth'
import type { ProfileUpdateInput } from '../types/profile'

const toUser = (value: unknown): Omit<User, 'subscription'> => {
  const user = value as Partial<User>

  if (!user?.email || !user.name) {
    throw new Error('Profile not found')
  }

  return {
    id: user.id ?? '',
    name: user.name,
    email: user.email,
    type: user.type ?? 'User',
    role: user.role ?? null,
    age: user.age ?? null,
    score: user.score ?? null,
    avatarUrl: user.avatarUrl ?? null,
  }
}

export const getProfile = async (currentUser: User) => {
  const { data, error } = await supabase.rpc('get_my_profile')

  if (error || !data) {
    throw new Error(error?.message || 'Failed to load profile')
  }

  return {
    ...toUser(data),
    type: currentUser.type,
    role: currentUser.role,
    subscription: currentUser.subscription,
  }
}

export const updateProfile = async (
  currentUser: User,
  profile: ProfileUpdateInput,
) => {
  const { data, error } = await supabase.rpc('update_my_profile', {
    p_name: profile.name,
    p_age: profile.age,
  })

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update profile')
  }

  return {
    ...toUser(data),
    type: currentUser.type,
    role: currentUser.role,
    subscription: currentUser.subscription,
  }
}
