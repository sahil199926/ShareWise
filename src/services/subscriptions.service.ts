import { supabase } from '../lib/supabase'
import { getFirebaseAccessToken } from '../lib/firebase'
import type {
  SubscriptionPlanDefinition,
  SubscriptionRecord,
} from '../types/subscription'

export const listSubscriptionPlans = async () => {
  const { data, error } = await supabase.rpc('list_subscription_plans')
  if (error || !Array.isArray(data)) {
    throw new Error(error?.message || 'Could not load subscription plans')
  }
  return data as SubscriptionPlanDefinition[]
}

export const listMySubscriptions = async () => {
  const { data, error } = await supabase.rpc('list_my_subscriptions')
  if (error || !Array.isArray(data)) {
    throw new Error(error?.message || 'Could not load subscription history')
  }
  return data as SubscriptionRecord[]
}

export const chooseFreePlan = async () => {
  await billingRequest('/api/billing-free', {})
}

const billingRequest = async (path: string, body: object) => {
  const token = await getFirebaseAccessToken()
  if (!token) throw new Error('Sign in to continue')
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok)
    throw new Error(result.error || 'Payment could not be started')
  return result
}

export const startSubscription = (
  planId: string,
  billingInterval: 'monthly' | 'yearly',
) =>
  billingRequest('/api/billing-start', { planId, billingInterval }) as Promise<{
    keyId: string
    subscriptionId: string
  }>

export const confirmSubscription = (
  subscriptionId: string,
  paymentId: string,
  signature: string,
) =>
  billingRequest('/api/billing-confirm', {
    subscriptionId,
    paymentId,
    signature,
  }) as Promise<{
    active?: boolean
    pending?: boolean
    message?: string
  }>
