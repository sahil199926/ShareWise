import { createContext } from 'react'
import type { GroupSummary, User } from '../types/auth'

export type AuthContextValue = {
  user: User | null
  groups: GroupSummary[]
  activeGroup: GroupSummary | null
  isAuthenticated: boolean
  isBootstrapping: boolean
  selectGroup: (groupId: string) => void
  refreshContext: () => Promise<void>
  updateUser: (user: User) => void
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
