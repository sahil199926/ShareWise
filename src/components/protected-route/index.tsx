import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/use-auth'
import type { ReactNode } from 'react'
import LazyFallback from '../lazy-fallback'
import SubscriptionBlocked from '../subscription-blocked'

type ProtectedRouteProps = {
  children: ReactNode
  allowWithoutGroup?: boolean
  allowBillingWhenBlocked?: boolean
}

const ProtectedRoute = ({
  children,
  allowWithoutGroup = false,
  allowBillingWhenBlocked = false,
}: ProtectedRouteProps) => {
  const { isAuthenticated, isBootstrapping, activeGroup, user } = useAuth()
  const location = useLocation()

  if (isBootstrapping) {
    return <LazyFallback />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (user?.subscription.accessBlocked && !allowBillingWhenBlocked) {
    return <SubscriptionBlocked />
  }

  if (
    location.pathname === '/onboarding' &&
    !activeGroup &&
    !user?.planChoiceCompleted
  ) {
    return <Navigate to="/plans" replace />
  }

  if (!allowWithoutGroup && !activeGroup) {
    return (
      <Navigate
        to={user?.planChoiceCompleted ? '/onboarding' : '/plans'}
        replace
      />
    )
  }

  return children
}

export default ProtectedRoute
