export const SUPER_ADMIN_TYPE = 'SUPER ADMIN'
export const USER_TYPE = 'User'

export const USER_TYPES = [SUPER_ADMIN_TYPE, USER_TYPE] as const

export type UserType = (typeof USER_TYPES)[number]

export const DEFAULT_USER_TYPE: UserType = USER_TYPE

export const isValidUserType = (value: string): value is UserType => {
  return USER_TYPES.includes(value as UserType)
}

export const getUserTypeBadgeClass = (type: string) => {
  if (type.trim().toUpperCase() === SUPER_ADMIN_TYPE) {
    return 'type-badge-admin'
  }

  return 'type-badge-user'
}
