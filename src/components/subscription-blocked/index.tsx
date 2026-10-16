import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/use-auth'
import Logo from '../logo'

const SubscriptionBlocked = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const dueDate = user?.subscription.currentPeriodEnd
    ? new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(user.subscription.currentPeriodEnd))
    : null

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <main className="glass-card w-full max-w-lg p-7 text-center sm:p-10">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>
        <p className="section-label mt-8">Payment required</p>
        <h1 className="mt-2 text-2xl font-semibold text-high">
          Your subscription needs renewal
        </h1>
        <p className="mt-3 text-sm leading-6 text-low">
          Your {user?.subscription.storedPlan ?? 'paid'} plan
          {dueDate ? ` ended on ${dueDate}` : ' is not active'}. Your data is
          safe, but app access and new debt creation are paused until payment is
          completed.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            className="btn-primary"
            href={
              import.meta.env.VITE_PRICING_URL ||
              'mailto:contact@eonlint.com?subject=Karja%20subscription%20renewal'
            }
          >
            Renew subscription
          </a>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              void logout().then(() => navigate('/login', { replace: true }))
            }}
          >
            Log out
          </button>
        </div>
        <p className="mt-5 text-xs text-low">
          Online payment will be enabled with the Razorpay onboarding flow.
        </p>
      </main>
    </div>
  )
}

export default SubscriptionBlocked
