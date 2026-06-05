import { createContext } from 'react'
import type { User } from '../types/auth'

export type AuthContextValue = {
  user: User | null
  isAuthenticated: boolean
  isBootstrapping: boolean
  login: (user: User) => void
  updateUser: (user: User) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
