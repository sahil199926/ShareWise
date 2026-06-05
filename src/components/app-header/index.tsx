import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../hooks/use-auth'
import { isSuperAdmin } from '../../lib/auth-utils'
import Logo from '../logo'
import ProfileMenu from '../profile-menu'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard', adminOnly: false },
  { to: '/master', label: 'MASTER Sheet', adminOnly: true },
] as const

type AppHeaderProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
  onLogout: () => void
}

const AppHeader = ({ title, subtitle, actions, onLogout }: AppHeaderProps) => {
  const { user, isBootstrapping } = useAuth()
  const { pathname } = useLocation()

  const visibleNavLinks = NAV_LINKS.filter((link) => {
    if (!link.adminOnly) return true
    if (isBootstrapping) return false
    return isSuperAdmin(user)
  })

  return (
    <header className="border-b border-divider bg-surface">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-divider py-4 sm:flex-row sm:items-center sm:justify-between">
          <Logo linkTo="/dashboard" size="md" />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {actions}
            <ProfileMenu />
            <button type="button" onClick={onLogout} className="btn-ghost">
              Log out
            </button>
          </div>
        </div>

        <div className="py-4">
          <h1 className="text-xl font-semibold text-high sm:text-2xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-low">{subtitle}</p>
          ) : null}
        </div>

        <nav className="-mb-px flex gap-1 overflow-x-auto border-t border-divider py-2">
          {visibleNavLinks.map((link) => {
            const isActive = pathname === link.to

            return (
              <Link
                key={link.to}
                to={link.to}
                className={isActive ? 'nav-link-active' : 'nav-link'}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

export default AppHeader
