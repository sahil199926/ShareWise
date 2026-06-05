import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getStoredAuth, setStoredAuth } from '../lib/storage'
import { getProfile } from '../services/profile.service'
import type { User } from '../types/auth'
import { AuthContext } from './auth-context'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => getStoredAuth())
  const [isBootstrapping, setIsBootstrapping] = useState(() =>
    Boolean(getStoredAuth()?.email),
  )

  useEffect(() => {
    const storedUser = getStoredAuth()

    if (!storedUser?.email) {
      return
    }

    let cancelled = false

    getProfile(storedUser.email)
      .then((freshUser) => {
        if (cancelled) return

        setUser(freshUser)
        setStoredAuth(freshUser)
      })
      .catch(() => {
        // Keep the cached session if the profile refresh fails.
      })
      .finally(() => {
        if (!cancelled) {
          setIsBootstrapping(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback((nextUser: User) => {
    setUser(nextUser)
    setStoredAuth(nextUser)
    setIsBootstrapping(false)
  }, [])

  const updateUser = useCallback((nextUser: User) => {
    setUser(nextUser)
    setStoredAuth(nextUser)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setStoredAuth(null)
    setIsBootstrapping(false)
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isBootstrapping,
      login,
      updateUser,
      logout,
    }),
    [user, isBootstrapping, login, updateUser, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
