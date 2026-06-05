import { SUPER_ADMIN_TYPE } from '../constants/user-types'
import type { User } from '../types/auth'

export { SUPER_ADMIN_TYPE }

export const isSuperAdmin = (user: User | null | undefined) => {
  if (!user?.type) return false
  return user.type.trim().toUpperCase() === SUPER_ADMIN_TYPE
}

export const isSameUserEmail = (left: string, right: string) => {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}
