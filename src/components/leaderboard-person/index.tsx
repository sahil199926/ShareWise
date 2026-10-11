import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Avatar from '../avatar'
import DayRangeFilter from '../day-range-filter'
import LeaderboardDetail from '../leaderboard-detail'
import LeaderboardFrame from '../leaderboard-frame'
import { StatCardSkeleton } from '../skeleton'
import { useAuth } from '../../hooks/use-auth'
import { buildLeaderboard, type DayRange } from '../../lib/leaderboard'
import { listDebts } from '../../services/debts.service'
import {
  avatarForEmail,
  listLeaderboardFaces,
} from '../../services/users.service'
import type { Debt } from '../../types/debt'

const LeaderboardPerson = () => {
  const { user } = useAuth()
  const { email: emailParam = '' } = useParams()
  const email = decodeURIComponent(emailParam).trim().toLowerCase()
  const [debts, setDebts] = useState<Debt[]>([])
  const [faces, setFaces] = useState<Record<string, string | null>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState<DayRange>(30)

  useEffect(() => {
    let cancelled = false

    listDebts()
      .then(async (nextDebts) => {
        if (cancelled) return
        setDebts(nextDebts)
        const nextFaces = await listLeaderboardFaces([email])
        if (!cancelled) setFaces(nextFaces)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load this person',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [email])

  const person = useMemo(() => {
    return (
      buildLeaderboard(debts).find((entry) => entry.email === email) ?? null
    )
  }, [debts, email])

  return (
    <LeaderboardFrame
      title={person?.name ?? 'Player'}
      subtitle="Contributions, what they still owe, and what is coming in."
      headerAside={<DayRangeFilter value={range} onChange={setRange} />}
      titleLeading={
        person ? (
          <Avatar
            name={person.name}
            avatarUrl={avatarForEmail(person.email, faces, user)}
            className="h-12 w-12 text-sm"
          />
        ) : null
      }
    >
      <Link to="/leaderboard" className="link-accent">
        ← Back to leaderboard
      </Link>

      {error ? <p className="alert-error mt-6">{error}</p> : null}

      {isLoading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : null}

      {!isLoading && !person ? (
        <p className="glass-card mt-6 px-5 py-8 text-center text-sm text-low">
          This person is not on the board yet.
        </p>
      ) : null}

      {person ? (
        <div className="mt-6">
          <LeaderboardDetail person={person} debts={debts} range={range} />
        </div>
      ) : null}
    </LeaderboardFrame>
  )
}

export default LeaderboardPerson
