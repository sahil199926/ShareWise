import type { SubscriptionEntitlements } from '../types/auth'

export const FREE_SUBSCRIPTION: SubscriptionEntitlements = {
  subscriptionId: null,
  plan: 'free',
  storedPlan: 'free',
  status: 'active',
  billingInterval: null,
  priceInr: 0,
  startedAt: null,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  cancelledAt: null,
  showRenewalBanner: false,
  accessBlocked: false,
  maxCreatedGroups: 1,
  maxJoinedGroups: 2,
  maxMembersPerGroup: 3,
  historyMonths: 1,
  monthlyDebtLimit: 30,
  monthlyDebtUsed: 0,
}

export const subscriptionHistoryDays = (historyMonths: number) => {
  if (historyMonths <= 1) return 30
  if (historyMonths >= 120) return 3650
  if (historyMonths >= 24) return 730
  return 60
}

export const subscriptionHistoryLabel = (historyMonths: number) => {
  if (historyMonths <= 1) return '1-month history'
  if (historyMonths >= 120) return '10-year history'
  if (historyMonths >= 24) return '2-year history'
  return '2-month history'
}
