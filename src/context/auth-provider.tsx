import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User as FirebaseUser } from '@firebase/auth'
import {
  firebaseReady,
  getFirebaseAuth,
  signOutFromFirebase,
  subscribeToFirebaseUser,
} from '../lib/firebase'
import { getMyContext } from '../services/auth.service'
import type { GroupSummary, User } from '../types/auth'
import { AuthContext } from './auth-context'

const ACTIVE_GROUP_KEY = 'karja_active_group_id'

const roleType = (role: GroupSummary['role'] | null) =>
  role === 'owner' || role === 'admin' ? 'SUPER ADMIN' : 'User'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [baseUser, setBaseUser] = useState<Omit<User, 'type' | 'role'> | null>(
    null,
  )
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [activeGroupId, setActiveGroupId] = useState(
    () => localStorage.getItem(ACTIVE_GROUP_KEY) ?? '',
  )
  const [isBootstrapping, setIsBootstrapping] = useState(firebaseReady)

  const loadContext = useCallback(async (nextUser?: FirebaseUser | null) => {
    const resolvedUser =
      nextUser === undefined ? getFirebaseAuth().currentUser : nextUser

    setFirebaseUser(resolvedUser)
    if (!resolvedUser) {
      setBaseUser(null)
      setGroups([])
      setIsBootstrapping(false)
      return
    }

    const context = await getMyContext()
    setBaseUser(context.user)
    setGroups(context.groups)
    setActiveGroupId((current) => {
      const remembered = context.groups.some((group) => group.id === current)
        ? current
        : (context.groups[0]?.id ?? '')
      if (remembered) localStorage.setItem(ACTIVE_GROUP_KEY, remembered)
      else localStorage.removeItem(ACTIVE_GROUP_KEY)
      return remembered
    })
    setIsBootstrapping(false)
  }, [])

  useEffect(() => {
    let cancelled = false

    if (!firebaseReady) {
      return () => {
        cancelled = true
      }
    }

    const unsubscribe = subscribeToFirebaseUser((nextUser) => {
      if (cancelled) return
      setIsBootstrapping(true)
      void loadContext(nextUser).catch(() => {
        if (cancelled) return
        setBaseUser(null)
        setGroups([])
        setIsBootstrapping(false)
      })
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [loadContext])

  const activeGroup =
    groups.find((group) => group.id === activeGroupId) ?? groups[0] ?? null

  const user = useMemo<User | null>(() => {
    if (!baseUser) return null
    return {
      ...baseUser,
      role: activeGroup?.role ?? null,
      type: roleType(activeGroup?.role ?? null),
    }
  }, [activeGroup?.role, baseUser])

  const selectGroup = useCallback((groupId: string) => {
    localStorage.setItem(ACTIVE_GROUP_KEY, groupId)
    setActiveGroupId(groupId)
  }, [])

  const updateUser = useCallback((nextUser: User) => {
    setBaseUser({
      id: nextUser.id,
      name: nextUser.name,
      email: nextUser.email,
      age: nextUser.age,
      score: nextUser.score,
      avatarUrl: nextUser.avatarUrl,
    })
  }, [])

  const logout = useCallback(async () => {
    await signOutFromFirebase()
    localStorage.removeItem(ACTIVE_GROUP_KEY)
    setFirebaseUser(null)
    setBaseUser(null)
    setGroups([])
    setActiveGroupId('')
  }, [])

  const value = useMemo(
    () => ({
      user,
      groups,
      activeGroup,
      isAuthenticated: Boolean(firebaseUser && baseUser),
      isBootstrapping,
      selectGroup,
      refreshContext: loadContext,
      updateUser,
      logout,
    }),
    [
      activeGroup,
      baseUser,
      groups,
      isBootstrapping,
      loadContext,
      logout,
      selectGroup,
      firebaseUser,
      updateUser,
      user,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
