import type { SubscriptionEntitlements } from './auth'

export type MasterUser = {
  id: string
  membershipId?: string
  name: string
  email: string
  type: string
  role?: 'owner' | 'admin' | 'member'
  status?: 'active' | 'invited'
  age: number | null
  score: number | null
  avatarUrl?: string | null
  subscription?: SubscriptionEntitlements
}

export type MasterUserInput = {
  name: string
  email: string
  type: string
  age: number | null
  score: number | null
}
