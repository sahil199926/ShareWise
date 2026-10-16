import { signInWithGooglePopup } from '../lib/firebase'
import { supabase } from '../lib/supabase'
import { FREE_SUBSCRIPTION } from '../constants/subscription-plans'
import type { AuthContextPayload } from '../types/auth'

export const signInWithGoogle = async (returnPath = '/dashboard') => {
  sessionStorage.setItem('karja_auth_return_path', returnPath)
  await signInWithGooglePopup()
}

export const getMyContext = async () => {
  const { data, error } = await supabase.rpc('get_my_context')
  if (error || !data) {
    throw new Error(error?.message || 'Could not load your groups')
  }
  const context = data as AuthContextPayload
  const { data: planChoice, error: planChoiceError } = context.groups.length
    ? { data: true, error: null }
    : await supabase.rpc('get_my_plan_choice_status')
  if (planChoiceError) throw new Error(planChoiceError.message)
  const userSubscription = {
    ...FREE_SUBSCRIPTION,
    ...(context.user.subscription ?? {}),
  }
  return {
    ...context,
    user: {
      ...context.user,
      planChoiceCompleted: Boolean(planChoice),
      subscription: userSubscription,
    },
    groups: context.groups.map((group) => ({
      ...group,
      subscriptionOwner: group.subscriptionOwner ?? {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
      },
      subscription: {
        ...FREE_SUBSCRIPTION,
        ...(group.subscription ?? userSubscription),
      },
      canCreateDebt: group.canCreateDebt ?? true,
      freezeReason: group.freezeReason ?? null,
    })),
  }
}
