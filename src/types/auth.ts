export type User = {
  id: string
  name: string
  email: string
  type: string
  role: GroupRole | null
  age: number | null
  score: number | null
  avatarUrl?: string | null
}

export type GroupRole = 'owner' | 'admin' | 'member'

export type GroupSummary = {
  id: string
  name: string
  role: GroupRole
  sheetSyncEnabled: boolean
  memberLimit: number
}

export type AuthContextPayload = {
  user: Omit<User, 'type' | 'role'>
  groups: GroupSummary[]
}
