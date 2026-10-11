import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import Avatar from '../avatar'
import BoardCheer from '../board-cheer'
import DayRangeFilter from '../day-range-filter'
import LeaderboardFrame from '../leaderboard-frame'
import { StatCardSkeleton } from '../skeleton'
import { useAuth } from '../../hooks/use-auth'
import { formatRupee } from '../../lib/debt-utils'
import {
  buildLeaderboard,
  filterDebtsByDays,
  rankBoard,
  type BoardId,
  type DayRange,
} from '../../lib/leaderboard'
import { listDebts } from '../../services/debts.service'
import {
  avatarForEmail,
  listLeaderboardFaces,
} from '../../services/users.service'
import type { Debt } from '../../types/debt'

const BOARDS: {
  id: BoardId
  label: string
  hint: string
  summary: (days: DayRange) => string
  tone: string
}[] = [
  {
    id: 'receivers',
    label: 'Receivers',
    hint: 'Open money coming in',
    summary: (days) =>
      `These people will receive the most money in the last ${days} days.`,
    tone: 'bg-[#16a34a]',
  },
  {
    id: 'contributors',
    label: 'Contributors',
    hint: 'Already settled and paid',
    summary: (days) =>
      `These people have paid back the most in the last ${days} days.`,
    tone: 'bg-[#15803d]',
  },
  {
    id: 'owed',
    label: 'Top owed',
    hint: 'Still to give',
    summary: (days) =>
      `These people still have to give the most in the last ${days} days.`,
    tone: 'bg-[#dc2626]',
  },
]

const amountClass: Record<BoardId, string> = {
  receivers: 'text-emerald-deep',
  contributors: 'text-emerald-deep',
  owed: 'text-[#b91c1c]',
}

const personPath = (email: string) =>
  `/leaderboard/${encodeURIComponent(email)}`

const Leaderboard = () => {
  const { user } = useAuth()
  const [debts, setDebts] = useState<Debt[]>([])
  const [faces, setFaces] = useState<Record<string, string | null>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [board, setBoard] = useState<BoardId>('receivers')
  const [range, setRange] = useState<DayRange>(30)

  useEffect(() => {
    let cancelled = false

    listDebts()
      .then(async (nextDebts) => {
        if (cancelled) return
        setDebts(nextDebts)
        const emails = nextDebts.flatMap((debt) => [
          debt.debtorEmail,
          debt.creditorEmail,
        ])
        const nextFaces = await listLeaderboardFaces(emails)
        if (!cancelled) setFaces(nextFaces)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load the board',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const people = useMemo(
    () => buildLeaderboard(filterDebtsByDays(debts, range)),
    [debts, range],
  )
  const ranked = useMemo(() => rankBoard(people, board), [board, people])
  const maxAmount = ranked[0]?.amount ?? 0
  const spotlights = useMemo(
    () =>
      (['receivers', 'contributors'] as const).map((id) => ({
        id,
        top: rankBoard(people, id)[0] ?? null,
        meta: BOARDS.find((item) => item.id === id)!,
      })),
    [people],
  )

  return (
    <LeaderboardFrame
      title="Leaderboard"
      subtitle="Open to everyone. Scores come from real karja."
      headerAside={<DayRangeFilter value={range} onChange={setRange} />}
    >
      {error ? <p className="alert-error">{error}</p> : null}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {spotlights.map((spot) => {
            const card = (
              <>
                <p className="section-label">{spot.meta.label}</p>
                <div className="mt-3 flex items-center gap-3">
                  {spot.top ? (
                    <Avatar
                      name={spot.top.name}
                      avatarUrl={avatarForEmail(spot.top.email, faces, user)}
                      className="h-12 w-12 text-sm"
                    />
                  ) : null}
                  <p className="truncate text-2xl font-bold text-high">
                    {spot.top?.name ?? 'No one yet'}
                  </p>
                </div>
                <p
                  className={`mt-2 text-3xl font-bold ${amountClass[spot.id]}`}
                >
                  {spot.top ? formatRupee(spot.top.amount) : '₹0'}
                </p>
                <p className="mt-2 text-sm text-low">{spot.meta.hint}</p>
              </>
            )

            if (!spot.top) {
              return (
                <div key={spot.id} className="glass-card p-5">
                  {card}
                </div>
              )
            }

            return (
              <Link
                key={spot.id}
                to={personPath(spot.top.email)}
                className="glass-card p-5 transition hover:-translate-y-0.5"
              >
                {card}
              </Link>
            )
          })}
        </div>
      )}

      <div className="mt-8">
        <div className="flex flex-wrap gap-2">
          {BOARDS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setBoard(item.id)}
              className={
                board === item.id ? 'filter-chip-active' : 'filter-chip'
              }
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-medium">
          {BOARDS.find((item) => item.id === board)?.summary(range)}
        </p>
      </div>

      <div className="relative mt-4">
        <BoardCheer key={board} board={board} />
        <div className="space-y-3">
          {!isLoading && ranked.length === 0 ? (
            <p className="glass-card px-5 py-8 text-center text-sm text-low">
              Nothing on this board in the last {range} days.
            </p>
          ) : null}

          {ranked.map((person, index) => {
            const width = maxAmount > 0 ? (person.amount / maxAmount) * 100 : 0
            const tone = BOARDS.find((item) => item.id === board)?.tone

            return (
              <Link
                key={person.email}
                to={personPath(person.email)}
                className="glass-card block p-4 sm:p-5"
              >
                <div className="flex items-center gap-4">
                  <span className="w-6 shrink-0 text-2xl font-bold text-emerald-deep sm:w-8 sm:text-3xl">
                    {index + 1}
                  </span>
                  <Avatar
                    name={person.name}
                    avatarUrl={avatarForEmail(person.email, faces, user)}
                    className="h-9 w-9 text-xs sm:h-11 sm:w-11 sm:text-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-lg font-semibold text-high">
                        {person.name}
                      </p>
                      <p
                        className={`shrink-0 text-base font-bold sm:text-xl ${amountClass[board]}`}
                      >
                        {formatRupee(person.amount)}
                      </p>
                    </div>
                    <div className="mt-3 h-4 overflow-hidden rounded-full bg-emerald/10">
                      <motion.div
                        className={`h-full rounded-full ${tone}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{
                          duration: 0.45,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </LeaderboardFrame>
  )
}

export default Leaderboard
