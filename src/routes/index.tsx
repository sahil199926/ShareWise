import { Navigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import ProtectedRoute from '../components/protected-route'
import LazyRoute from './lazy-route'
import {
  ConfirmPaymentPage,
  DashboardPage,
  DebtOverviewPage,
  GroupOnboardingPage,
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
    path: '/confirm-payment/:groupId/:id',
    element: (
      <ProtectedRoute>
        <LazyRoute>
          <ConfirmPaymentPage />
        </LazyRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/share/:token',
    element: (
      <LazyRoute>
        <PublicDebtsPage />
      </LazyRoute>
    ),
  },
  {
    path: '/leaderboard',
    element: (
      <ProtectedRoute>
        <LazyRoute>
          <LeaderboardPage />
        </LazyRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/leaderboard/:email',
    element: (
      <ProtectedRoute>
        <LazyRoute>
          <LeaderboardPersonPage />
        </LazyRoute>
      </ProtectedRoute>
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
    path: '/onboarding',
    element: (
      <ProtectedRoute allowWithoutGroup>
        <LazyRoute>
          <GroupOnboardingPage />
        </LazyRoute>
      </ProtectedRoute>
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
        <LazyRoute>
          <MasterPage />
        </LazyRoute>
      </ProtectedRoute>
    ),
  },
]
