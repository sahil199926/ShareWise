import type { User } from '../types/auth'

const AUTH_STORAGE_KEY = 'expense_tracker_auth'

export const getStoredAuth = (): User | null => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export const setStoredAuth = (user: User | null) => {
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
    return
  }

  localStorage.removeItem(AUTH_STORAGE_KEY)
}
