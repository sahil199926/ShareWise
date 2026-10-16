export type SubscriptionPlan = 'free' | 'basic' | 'advanced' | 'pro'

export type SubscriptionEntitlements = {
  plan: SubscriptionPlan
  storedPlan: SubscriptionPlan
  status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'expired'
  billingInterval: 'monthly' | 'yearly' | null
  priceInr: number
  currentPeriodEnd: string | null
  showRenewalBanner: boolean
  accessBlocked: boolean
  maxCreatedGroups: number
  maxJoinedGroups: number
  maxMembersPerGroup: number
  maxDailyEmailAlerts: number
  historyMonths: number
  monthlyDebtLimit: number
  monthlyDebtUsed: number
}

export type User = {
  id: string
  name: string
  email: string
  type: string
  role: GroupRole | null
  age: number | null
  score: number | null
  avatarUrl?: string | null
  subscription: SubscriptionEntitlements
}

export type GroupRole = 'owner' | 'admin' | 'member'

export type GroupSummary = {
  id: string
  name: string
  role: GroupRole
  sheetSyncEnabled: boolean
  memberLimit: number
  subscriptionOwner: {
    id: string
    name: string
    email: string
  }
  subscription: SubscriptionEntitlements
  canCreateDebt: boolean
  freezeReason: string | null
}

export type AuthContextPayload = {
  user: Omit<User, 'type' | 'role'>
  groups: GroupSummary[]
}
