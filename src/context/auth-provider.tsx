import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  AUTH_STORAGE_KEY,
  getStoredAuth,
  setStoredAuth,
} from '../lib/storage'
import { getProfile } from '../services/profile.service'
import type { User } from '../types/auth'
import { AuthContext } from './auth-context'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => getStoredAuth())
  const [isBootstrapping, setIsBootstrapping] = useState(() =>
    Boolean(getStoredAuth()?.email),
  )
  const sessionRef = useRef(0)

  useEffect(() => {
    const storedUser = getStoredAuth()

    if (!storedUser?.email) {
      setIsBootstrapping(false)
      return
    }

    const generation = sessionRef.current
    let cancelled = false

    getProfile(storedUser.email)
      .then((freshUser) => {
        if (cancelled || generation !== sessionRef.current) return

        setUser(freshUser)
        setStoredAuth(freshUser)
      })
      .catch(() => {
        // Keep the cached session if the profile refresh fails.
      })
      .finally(() => {
        if (!cancelled && generation === sessionRef.current) {
          setIsBootstrapping(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== AUTH_STORAGE_KEY) return

      sessionRef.current += 1

      if (!event.newValue) {
        setUser(null)
        setIsBootstrapping(false)
        return
      }

      try {
        const parsed: unknown = JSON.parse(event.newValue)
        if (parsed && typeof parsed === 'object' && 'email' in parsed) {
          const nextUser = parsed as User
          if (nextUser.email?.trim()) {
            setUser(nextUser)
          }
        }
      } catch {
        setUser(null)
      }
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const login = useCallback((nextUser: User) => {
    sessionRef.current += 1
    setUser(nextUser)
    setStoredAuth(nextUser)
    setIsBootstrapping(false)
  }, [])

  const updateUser = useCallback((nextUser: User) => {
    sessionRef.current += 1
    setUser(nextUser)
    setStoredAuth(nextUser)
  }, [])

  const logout = useCallback(() => {
    sessionRef.current += 1
    setUser(null)
    setStoredAuth(null)
    setIsBootstrapping(false)
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user?.email?.trim()),
      isBootstrapping,
      login,
      updateUser,
      logout,
    }),
    [user, isBootstrapping, login, updateUser, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
