import { useAuth } from '../../hooks/use-auth'

const renewalDate = (value: string | null) => {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

const SubscriptionBanner = () => {
  const { user } = useAuth()
  const subscription = user?.subscription

  if (!subscription?.showRenewalBanner || !subscription.currentPeriodEnd) {
    return null
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-900">
      <strong className="font-semibold">Subscription renewal due soon.</strong>{' '}
      Your {subscription.storedPlan} plan renews on{' '}
      {renewalDate(subscription.currentPeriodEnd)}. Please pay before the due
      date to keep your account and admin groups active.
    </div>
  )
}

export default SubscriptionBanner
