import { isValidUser } from './auth-utils'
import type { User } from '../types/auth'

export const AUTH_STORAGE_KEY = 'expense_tracker_auth'

export const getStoredAuth = (): User | null => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (!isValidUser(parsed)) {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      return null
    }

    return parsed
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY)
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
