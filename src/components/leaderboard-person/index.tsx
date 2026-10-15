import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Avatar from '../avatar'
import DayRangeFilter from '../day-range-filter'
import LeaderboardDetail from '../leaderboard-detail'
import LeaderboardFrame from '../leaderboard-frame'
import { StatCardSkeleton } from '../skeleton'
import { useAuth } from '../../hooks/use-auth'
import {
  DAY_RANGES,
  buildLeaderboard,
  filterDebtsByDays,
  type DayRange,
} from '../../lib/leaderboard'
import { setShareMeta, shareCopy } from '../../lib/share-copy'
import { listDebts } from '../../services/debts.service'
import {
  avatarForEmail,
  listLeaderboardFaces,
} from '../../services/users.service'
import type { Debt } from '../../types/debt'

const LeaderboardPerson = () => {
  const { user, activeGroup } = useAuth()
  const { email: emailParam = '' } = useParams()
  const email = decodeURIComponent(emailParam).trim().toLowerCase()
  const [debts, setDebts] = useState<Debt[]>([])
  const [faces, setFaces] = useState<Record<string, string | null>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedDays = Number(searchParams.get('days'))
  const [range, setRange] = useState<DayRange>(
    DAY_RANGES.includes(requestedDays as DayRange)
      ? (requestedDays as DayRange)
      : 30,
  )

  useEffect(() => {
    if (!activeGroup) return
    let cancelled = false

    listDebts(activeGroup.id)
      .then(async (nextDebts) => {
        if (cancelled) return
        setDebts(nextDebts)
        const nextFaces = await listLeaderboardFaces(activeGroup.id, [email])
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
  }, [activeGroup, email])

  const person = useMemo(() => {
    return (
      buildLeaderboard(debts).find((entry) => entry.email === email) ?? null
    )
  }, [debts, email])

  const windowPerson = useMemo(() => {
    return (
      buildLeaderboard(filterDebtsByDays(debts, range)).find(
        (entry) => entry.email === email,
      ) ?? null
    )
  }, [debts, email, range])

  useEffect(() => {
    const name = windowPerson?.name || person?.name
    if (!name) return

    const copy = shareCopy(
      {
        name,
        openOwe: windowPerson?.openOwe ?? 0,
        openReceive: windowPerson?.openReceive ?? 0,
        openOweCount: windowPerson?.openOweCount ?? 0,
        openReceiveCount: windowPerson?.openReceiveCount ?? 0,
      },
      range,
    )
    return setShareMeta(copy.title, copy.description)
  }, [person, range, windowPerson])

  return (
    <LeaderboardFrame
      title={person?.name ?? 'Player'}
      subtitle="Contributions, what they still owe, and what is coming in."
      headerAside={
        <DayRangeFilter
          value={range}
          onChange={(next) => {
            setRange(next)
            setSearchParams({ days: String(next) }, { replace: true })
          }}
        />
      }
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
