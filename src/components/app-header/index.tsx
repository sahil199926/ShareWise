import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { useAuth } from '../../hooks/use-auth'
import Logo from '../logo'
import ProfileMenu from '../profile-menu'
import SubscriptionBanner from '../subscription-banner'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Overview', adminOnly: false },
  { to: '/debt-overview', label: 'Debts', adminOnly: false },
  { to: '/leaderboard', label: 'Leaderboard', adminOnly: false },
  { to: '/master', label: 'Group details', adminOnly: false },
] as const

type AppHeaderProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
  navAside?: ReactNode
  titleLeading?: ReactNode
  onLogout: () => void
  showNavigation?: boolean
}

const AppHeader = ({
  title,
  subtitle,
  actions,
  navAside,
  titleLeading,
  onLogout,
  showNavigation = true,
}: AppHeaderProps) => {
  const { user, groups, activeGroup, selectGroup } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const visibleNavLinks = NAV_LINKS
  const createdGroupCount = groups.filter(
    (group) => group.role === 'owner',
  ).length
  const canCreateGroup =
    createdGroupCount < (user?.subscription.maxCreatedGroups ?? 2)

  return (
    <header className="border-b border-white/50 bg-white/45 backdrop-blur-xl">
      <SubscriptionBanner />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 py-3 sm:py-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Logo linkTo="/dashboard" size="md" />
            {activeGroup ? (
              <select
                aria-label="Active group"
                className="max-w-36 rounded-full border border-white/80 bg-white/70 px-3 py-2 text-xs font-medium text-medium sm:max-w-56 sm:text-sm"
                value={activeGroup.id}
                onChange={(event) => {
                  if (event.target.value === '__create__') {
                    navigate('/onboarding?create=1')
                    return
                  }
                  selectGroup(event.target.value)
                }}
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
                {canCreateGroup ? (
                  <option value="__create__">＋ Create group</option>
                ) : null}
              </select>
            ) : null}
          </div>

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
              <h1 className="text-lg font-semibold text-high sm:text-2xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-1 text-xs text-low sm:text-sm">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {actions ? (
            <div className="shrink-0 [&_button]:w-full sm:[&_button]:w-auto">
              {actions}
            </div>
          ) : null}
        </div>

        {showNavigation ? (
          <nav className="-mb-px flex w-full flex-col gap-2 border-t border-divider py-2 min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:items-center">
            <div className="flex flex-wrap gap-1">
              {visibleNavLinks.map((link) => {
                const isActive =
                  link.to === '/leaderboard'
                    ? pathname.startsWith('/leaderboard')
                    : pathname === link.to

                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`relative rounded-full px-3 py-1.5 text-xs font-medium transition sm:px-4 sm:text-sm ${
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
            {navAside ? (
              <div className="w-full min-[480px]:ml-auto min-[480px]:w-auto">
                {navAside}
              </div>
            ) : null}
          </nav>
        ) : null}
      </div>
    </header>
  )
}

export default AppHeader
