import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/use-auth'
import type { ReactNode } from 'react'
import LazyFallback from '../lazy-fallback'

type ProtectedRouteProps = {
  children: ReactNode
  allowWithoutGroup?: boolean
}

const ProtectedRoute = ({
  children,
  allowWithoutGroup = false,
}: ProtectedRouteProps) => {
  const { isAuthenticated, isBootstrapping, activeGroup } = useAuth()
  const location = useLocation()

  if (isBootstrapping) {
    return <LazyFallback />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!allowWithoutGroup && !activeGroup) {
    return <Navigate to="/onboarding" replace />
  }

  return children
}

export default ProtectedRoute
