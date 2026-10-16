import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/use-auth'
import PlanChooser from '../plan-chooser'
import Logo from '../logo'

const PlansPage = () => {
  const { user, groups, activeGroup, logout } = useAuth()
  const navigate = useNavigate()
  const canChoose =
    groups.length === 0 ||
    groups.some((group) => group.role === 'owner' || group.role === 'admin')
  if (!user) return null
  if (!canChoose) return <Navigate to="/dashboard" replace />
  if (!activeGroup && user.planChoiceCompleted)
    return <Navigate to="/onboarding" replace />

  return (
    <div className="min-h-screen px-4 py-8">
      <main className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <Logo size="md" />
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void logout()}
          >
            Log out
          </button>
        </div>
        <section className="glass-card mt-6 p-6 sm:p-8">
          <p className="section-label">Your subscription</p>
          <h1 className="mt-2 text-2xl font-semibold text-high">
            Choose how you will use Karja
          </h1>
          <p className="mt-2 text-sm text-low">
            {activeGroup
              ? 'Choose a plan for your account. A group uses its latest admin’s limits, or its owner’s when there is no admin.'
              : 'Select a plan before creating your first group.'}
          </p>
          <div className="mt-7">
            <PlanChooser
              onboarding={!activeGroup}
              onActivated={async () => {
                navigate(activeGroup ? '/profile#plans' : '/onboarding', {
                  replace: true,
                })
              }}
            />
          </div>
        </section>
      </main>
    </div>
  )
}

export default PlansPage
