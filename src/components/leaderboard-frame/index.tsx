import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppHeader from '../app-header'
import Logo from '../logo'
import { useAuth } from '../../hooks/use-auth'

type LeaderboardFrameProps = {
  title: string
  subtitle: string
  headerAside?: ReactNode
  titleLeading?: ReactNode
  children: ReactNode
}

const LeaderboardFrame = ({
  title,
  subtitle,
  headerAside,
  titleLeading,
  children,
}: LeaderboardFrameProps) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="page-shell">
      {user ? (
        <AppHeader
          title={title}
          subtitle={subtitle}
          navAside={headerAside}
          titleLeading={titleLeading}
          onLogout={handleLogout}
        />
      ) : (
        <header className="border-b border-white/50 bg-white/45 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
            <Logo size="md" />
            <Link to="/login" className="btn-primary">
              Sign in
            </Link>
          </div>
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 pb-6 sm:flex-row sm:items-end sm:justify-between sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              {titleLeading}
              <div>
                <h1 className="text-xl font-semibold text-high sm:text-2xl">
                  {title}
                </h1>
                <p className="mt-1 text-sm text-low">{subtitle}</p>
              </div>
            </div>
            {headerAside}
          </div>
        </header>
      )}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}

export default LeaderboardFrame
