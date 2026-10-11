import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { useAuth } from '../../hooks/use-auth'
import { isSuperAdmin } from '../../lib/auth-utils'
import Logo from '../logo'
import ProfileMenu from '../profile-menu'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Overview', adminOnly: false },
  { to: '/debt-overview', label: 'Debts', adminOnly: false },
  { to: '/leaderboard', label: 'Leaderboard', adminOnly: false },
  { to: '/master', label: 'People', adminOnly: true },
] as const

type AppHeaderProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
  navAside?: ReactNode
  titleLeading?: ReactNode
  onLogout: () => void
}

const AppHeader = ({
  title,
  subtitle,
  actions,
  navAside,
  titleLeading,
  onLogout,
}: AppHeaderProps) => {
  const { user, isBootstrapping } = useAuth()
  const { pathname } = useLocation()

  const visibleNavLinks = NAV_LINKS.filter((link) => {
    if (!link.adminOnly) return true
    if (isBootstrapping) return false
    return isSuperAdmin(user)
  })

  return (
    <header className="border-b border-white/50 bg-white/45 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 py-3 sm:py-4">
          <Logo linkTo="/dashboard" size="md" />

          <div className="flex shrink-0 items-center gap-2">
            <ProfileMenu />
            <button
              type="button"
              onClick={onLogout}
              aria-label="Log out"
              className="btn-ghost inline-flex size-10 items-center justify-center p-0 sm:size-auto sm:px-4 sm:py-2"
            >
              <svg
                className="size-4 sm:hidden"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6A2.25 2.25 0 0 0 5.25 5.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18 12H9m0 0 2.25-2.25M9 12l2.25 2.25"
                />
              </svg>
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-divider py-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {titleLeading}
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-high sm:text-2xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-1 text-sm text-low">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {actions ? (
            <div className="shrink-0 [&_button]:w-full sm:[&_button]:w-auto">
              {actions}
            </div>
          ) : null}
        </div>

        <nav className="-mb-px flex flex-wrap items-center gap-2 border-t border-divider py-2">
          <div className="flex gap-1 overflow-x-auto">
            {visibleNavLinks.map((link) => {
              const isActive =
                link.to === '/leaderboard'
                  ? pathname.startsWith('/leaderboard')
                  : pathname === link.to

              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`relative rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    isActive ? 'text-white' : 'text-low hover:text-high'
                  }`}
                >
                  {isActive ? (
                    <motion.span
                      layoutId="karja-tab"
                      className="absolute inset-0 rounded-full bg-brand shadow-sm"
                      transition={{
                        type: 'spring',
                        stiffness: 420,
                        damping: 34,
                      }}
                    />
                  ) : null}
                  <span className="relative z-10">{link.label}</span>
                </Link>
              )
            })}
          </div>
          {navAside ? <div className="ml-auto shrink-0">{navAside}</div> : null}
        </nav>
      </div>
    </header>
  )
}

export default AppHeader
