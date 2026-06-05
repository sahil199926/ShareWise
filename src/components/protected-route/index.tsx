import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/use-auth'
import type { ReactNode } from 'react'
import LazyFallback from '../lazy-fallback'

type ProtectedRouteProps = {
  children: ReactNode
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isBootstrapping } = useAuth()
  const location = useLocation()

  if (isBootstrapping) {
    return <LazyFallback />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}

export default ProtectedRoute
