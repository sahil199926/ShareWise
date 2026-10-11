import { lazy } from 'react'

export const LoginPage = lazy(() => import('../components/login'))
export const DashboardPage = lazy(() => import('../components/dashboard'))
export const DebtOverviewPage = lazy(
  () => import('../components/debt-overview'),
)
export const PublicDebtsPage = lazy(() => import('../components/public-debts'))
export const ConfirmPaymentPage = lazy(
  () => import('../components/confirm-payment'),
)
export const LeaderboardPage = lazy(() => import('../components/leaderboard'))
export const LeaderboardPersonPage = lazy(
  () => import('../components/leaderboard-person'),
)
export const ProfilePage = lazy(() => import('../components/profile'))
export const MasterPage = lazy(() => import('../components/master'))
