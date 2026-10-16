import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/use-auth'
import { subscriptionHistoryLabel } from '../../constants/subscription-plans'
import Avatar from '../avatar'

const ProfileMenu = () => {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  if (!user) {
    return null
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="flex items-center gap-2 rounded-full border border-white/80 bg-white/70 py-1 pr-1 pl-1 shadow-sm transition hover:bg-white sm:pr-2.5"
      >
        <Avatar
          name={user.name}
          avatarUrl={user.avatarUrl}
          className="h-8 w-8 text-xs"
        />
        <span className="hidden max-w-32 truncate text-sm font-medium text-medium sm:inline">
          {user.name}
        </span>
        <svg
          className={`hidden h-4 w-4 text-low transition sm:block ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-white/70 bg-white/85 py-2 shadow-lg backdrop-blur-xl">
          <div className="border-b border-divider px-4 py-3">
            <p className="section-label">Account</p>
            <p className="mt-1 truncate text-sm font-semibold text-high">
              {user.name}
            </p>
            <p className="truncate text-xs text-low">{user.email}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald">
              {user.subscription.plan} plan
              {user.subscription.billingInterval
                ? ` · ${user.subscription.billingInterval}`
                : ''}{' '}
              · {user.subscription.maxCreatedGroups} create /{' '}
              {user.subscription.maxJoinedGroups} join
            </p>
            <p className="mt-1 text-xs text-low">
              {subscriptionHistoryLabel(user.subscription.historyMonths)} ·{' '}
              {user.subscription.monthlyDebtLimit.toLocaleString('en-IN')}{' '}
              debts/month
            </p>
            <p className="mt-1 text-xs text-low">
              {user.subscription.monthlyDebtUsed.toLocaleString('en-IN')} used
              this month · {user.subscription.maxDailyEmailAlerts} email alert
              per day
            </p>
          </div>

          <Link
            to="/profile"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2.5 text-sm font-medium text-medium transition hover:bg-surface-elevated"
          >
            My profile
          </Link>
        </div>
      ) : null}
    </div>
  )
}

export default ProfileMenu
