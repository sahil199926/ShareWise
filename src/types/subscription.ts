import type { SubscriptionPlan } from './auth'

export type SubscriptionPlanDefinition = {
  id: SubscriptionPlan
  name: string
  monthlyPriceInr: number
  yearlyPriceInr: number
  maxCreatedGroups: number
  maxJoinedGroups: number
  maxMembersPerGroup: number
  historyMonths: number
  monthlyDebtLimit: number
}

export type SubscriptionRecord = {
  id: string
  plan: SubscriptionPlan
  billingInterval: 'monthly' | 'yearly' | null
  status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'expired'
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  cancelledAt: string | null
  isActive: boolean
  createdAt: string
}
