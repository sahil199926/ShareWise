import { Navigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import AdminRoute from '../components/admin-route'
import ProtectedRoute from '../components/protected-route'
import LazyRoute from './lazy-route'
import {
  DashboardPage,
  EditSheetPage,
  LoginPage,
  MasterPage,
  ProfilePage,
  ShareSheetPage,
} from './lazy-pages'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
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
  {
    path: '/edit-sheet/:id',
    element: (
      <ProtectedRoute>
        <LazyRoute>
          <EditSheetPage />
        </LazyRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '/share-sheet/:id',
    element: (
      <LazyRoute>
        <ShareSheetPage />
      </LazyRoute>
    ),
  },
]
