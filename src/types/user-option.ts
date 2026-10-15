export type MasterUserOption = {
  id?: string
  name: string
  email: string
  avatarUrl?: string | null
  status?: 'active' | 'invited'
}
