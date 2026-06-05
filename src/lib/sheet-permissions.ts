import { isSuperAdmin } from './auth-utils'
import type { User } from '../types/auth'

type SheetOwnerRef = {
  ownerEmail?: string
}

export const canEditSheet = (
  sheet: SheetOwnerRef,
  user: User | null | undefined,
) => {
  if (!user?.email) return false
  if (isSuperAdmin(user)) return true
  if (!sheet.ownerEmail) return false

  return (
    sheet.ownerEmail.trim().toLowerCase() === user.email.trim().toLowerCase()
  )
}
