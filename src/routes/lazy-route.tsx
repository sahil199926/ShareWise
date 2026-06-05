import { Suspense, type ReactNode } from 'react'
import LazyFallback from '../components/lazy-fallback'

type LazyRouteProps = {
  children: ReactNode
}

const LazyRoute = ({ children }: LazyRouteProps) => (
  <Suspense fallback={<LazyFallback />}>{children}</Suspense>
)

export default LazyRoute
