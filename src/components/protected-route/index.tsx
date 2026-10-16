import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/use-auth'
import type { ReactNode } from 'react'
import LazyFallback from '../lazy-fallback'
import SubscriptionBlocked from '../subscription-blocked'

type ProtectedRouteProps = {
  children: ReactNode
  allowWithoutGroup?: boolean
}

const ProtectedRoute = ({
  children,
  allowWithoutGroup = false,
}: ProtectedRouteProps) => {
  const { isAuthenticated, isBootstrapping, activeGroup, user } = useAuth()
  const location = useLocation()

  if (isBootstrapping) {
    return <LazyFallback />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (user?.subscription.accessBlocked) {
    return <SubscriptionBlocked />
  }

  if (!allowWithoutGroup && !activeGroup) {
    return <Navigate to="/onboarding" replace />
  }

  return children
}

export default ProtectedRoute
