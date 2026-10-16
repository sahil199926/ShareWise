import { supabase } from '../lib/supabase'
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
