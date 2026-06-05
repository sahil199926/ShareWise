import { lazy } from 'react'

export const LoginPage = lazy(() => import('../components/login'))
export const DashboardPage = lazy(() => import('../components/dashboard'))
export const ProfilePage = lazy(() => import('../components/profile'))
export const MasterPage = lazy(() => import('../components/master'))
export const EditSheetPage = lazy(() => import('../components/edit-sheet'))
export const ShareSheetPage = lazy(() => import('../components/share-sheet'))
