import { Navigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import AdminRoute from '../components/admin-route'
import ProtectedRoute from '../components/protected-route'
import LazyRoute from './lazy-route'
import {
  ConfirmPaymentPage,
  DashboardPage,
  DebtOverviewPage,
  LoginPage,
  LeaderboardPage,
  LeaderboardPersonPage,
  MasterPage,
  ProfilePage,
  PublicDebtsPage,
} from './lazy-pages'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/confirm-payment/:id',
    element: (
      <LazyRoute>
        <ConfirmPaymentPage />
      </LazyRoute>
    ),
  },
  {
    path: '/share/:email',
    element: (
      <LazyRoute>
        <PublicDebtsPage />
      </LazyRoute>
    ),
  },
  {
    path: '/leaderboard',
    element: (
      <LazyRoute>
        <LeaderboardPage />
      </LazyRoute>
    ),
  },
  {
    path: '/leaderboard/:email',
    element: (
      <LazyRoute>
        <LeaderboardPersonPage />
      </LazyRoute>
    ),
  },
  {
    path: '/login',
    element: (
      <LazyRoute>
        <LoginPage />
      </LazyRoute>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <LazyRoute>
          <DashboardPage />
        </LazyRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/debt-overview',
    element: (
      <ProtectedRoute>
        <LazyRoute>
          <DebtOverviewPage />
        </LazyRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/profile',
    element: (
      <ProtectedRoute>
        <LazyRoute>
          <ProfilePage />
        </LazyRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/master',
    element: (
      <ProtectedRoute>
        <AdminRoute>
          <LazyRoute>
            <MasterPage />
          </LazyRoute>
        </AdminRoute>
      </ProtectedRoute>
    ),
  },
]
