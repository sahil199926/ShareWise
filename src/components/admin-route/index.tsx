import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/use-auth'
import { isSuperAdmin } from '../../lib/auth-utils'
import type { ReactNode } from 'react'
import LazyFallback from '../lazy-fallback'

type AdminRouteProps = {
  children: ReactNode
}

const AdminRoute = ({ children }: AdminRouteProps) => {
  const { user, isBootstrapping } = useAuth()
  const location = useLocation()

  if (isBootstrapping) {
    return <LazyFallback />
  }

  if (!isSuperAdmin(user)) {
    return <Navigate to="/dashboard" replace state={{ from: location }} />
  }

  return children
}

export default AdminRoute
