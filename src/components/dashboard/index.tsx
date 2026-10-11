import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppHeader from '../app-header'
import DebtCard from '../debt-card'
import OverviewCharts from '../overview-charts'
import SelectField from '../select-field'
import {
  ChartCardSkeleton,
  DebtGridSkeleton,
  StatCardSkeleton,
} from '../skeleton'
import { useAuth } from '../../hooks/use-auth'
import { usePeopleFaces } from '../../hooks/use-people-faces'
import { isSuperAdmin } from '../../lib/auth-utils'
import {
  debtInvolvesEmail,
  formatRupee,
  isOpenDebt,
  sumOpenAmount,
} from '../../lib/debt-utils'
import {
  buildCounterpartBars,
  buildDayBars,
  buildStatusSlices,
  debtsForPerson,
  mergePeople,
} from '../../lib/overview-stats'
import { listDebts } from '../../services/debts.service'
import { listMasterUserOptions } from '../../services/users.service'
import { DEBT_STATUS, type Debt } from '../../types/debt'
import type { MasterUserOption } from '../../types/user-option'

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name

const Dashboard = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = isSuperAdmin(user)

  const [debts, setDebts] = useState<Debt[]>([])
  const [users, setUsers] = useState<MasterUserOption[]>([])
  const [subjectEmail, setSubjectEmail] = useState(user?.email ?? '')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const faces = usePeopleFaces(
    debts.flatMap((debt) => [debt.debtorEmail, debt.creditorEmail]),
  )

  useEffect(() => {
    if (!user?.email) return

    let cancelled = false

    const loadPeople = isAdmin
      ? listMasterUserOptions(user.email)
          .then((nextUsers) => {
            if (!cancelled) setUsers(nextUsers)
          })
          .catch((err) => {
            if (!cancelled) {
              setError(
                err instanceof Error ? err.message : 'Failed to load people',
              )
            }
          })
      : Promise.resolve()

    const loadKarja = listDebts()
      .then((nextDebts) => {
        if (cancelled) return
        setDebts(nextDebts)
        setError('')
      })
      .catch((err) => {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : 'Failed to load debts'
        setError(
          message.includes('public.debts')
            ? 'Debts table is missing in Supabase. Open the SQL editor and run supabase/schema.sql, then refresh.'
            : message,
        )
      })

    Promise.all([loadPeople, loadKarja]).finally(() => {
      if (!cancelled) setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [isAdmin, user?.email])

  const people = useMemo(() => {
    const directory = mergePeople(users, debts)
    if (!user?.email) return directory

    const selfKey = user.email.trim().toLowerCase()
    if (
      directory.some((person) => person.email.trim().toLowerCase() === selfKey)
    ) {
      return directory
    }

    return [{ name: user.name, email: user.email }, ...directory]
  }, [debts, user?.email, user?.name, users])

  const subject =
    people.find(
      (person) =>
        person.email.trim().toLowerCase() === subjectEmail.trim().toLowerCase(),
    ) ?? people[0]

  const email = subject?.email ?? user?.email ?? ''
  const name = subject?.name ?? user?.name ?? 'You'
  const isSelf =
    email.trim().toLowerCase() === (user?.email ?? '').trim().toLowerCase()
  const who = isSelf ? 'You' : firstName(name)
  const subjectLabel = isSelf ? 'you' : firstName(name)

  const mine = useMemo(() => debtsForPerson(debts, email), [debts, email])
  const youOwe = email ? sumOpenAmount(debts, email, 'debtor') : 0
  const youGet = email ? sumOpenAmount(debts, email, 'creditor') : 0
  const net = youGet - youOwe
  const waitingCount = mine.filter(
    (debt) => debt.status === DEBT_STATUS.CLOSE_REQUESTED,
  ).length
  const slices = useMemo(() => buildStatusSlices(debts, email), [debts, email])
  const counterparts = useMemo(
    () => buildCounterpartBars(debts, email),
    [debts, email],
  )
  const days = useMemo(() => buildDayBars(debts, email), [debts, email])
  const peerDebts = useMemo(() => {
    if (!email) return []
    return debts
      .filter((debt) => isOpenDebt(debt) && !debtInvolvesEmail(debt, email))
      .sort((left, right) => right.amount - left.amount)
  }, [debts, email])

  const netLabel =
    net > 0 ? 'Comes out ahead' : net < 0 ? 'Still to settle' : 'Even'
  const netClass =
    net > 0 ? 'text-emerald-deep' : net < 0 ? 'text-[#b91c1c]' : 'text-high'

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="page-shell">
      <AppHeader
        title={isSelf ? 'Your overview' : `${name}'s overview`}
        subtitle={
          isSelf
            ? 'What you will give, what you will get, and how it breaks down.'
            : `${firstName(name)}'s give, get, and how the karja breaks down.`
        }
        onLogout={handleLogout}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {isAdmin ? (
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-medium">Open any person’s overview.</p>
            <div className="flex items-center gap-3 text-sm text-medium">
              <span className="whitespace-nowrap">View as</span>
              <SelectField
                ariaLabel="View overview as"
                className="mt-0 w-full sm:w-56"
                value={email}
                onChange={setSubjectEmail}
                options={people.map((person) => ({
                  value: person.email,
                  label: person.name,
                }))}
              />
            </div>
          </div>
        ) : null}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <div className="glass-card p-5">
                <p className="section-label">{who} will give</p>
                <p className="mt-2 text-3xl font-bold text-high">
                  {formatRupee(youOwe)}
                </p>
              </div>
              <div className="glass-card p-5">
                <p className="section-label">{who} will get</p>
                <p className="mt-2 text-3xl font-bold text-emerald-deep">
                  {formatRupee(youGet)}
                </p>
              </div>
              <div className="glass-card p-5">
                <p className="section-label">{netLabel}</p>
                <p className={`mt-2 text-3xl font-bold ${netClass}`}>
                  {formatRupee(Math.abs(net))}
                </p>
              </div>
              <div className="glass-card p-5">
                <p className="section-label">Waiting on admin</p>
                <p className="mt-2 text-3xl font-bold text-high">
                  {waitingCount}
                </p>
              </div>
            </>
          )}
        </section>

        {error ? <div className="alert-error mt-6">{error}</div> : null}

        {isLoading ? (
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <ChartCardSkeleton />
            </div>
            <div className="lg:col-span-3">
              <ChartCardSkeleton />
            </div>
            <div className="lg:col-span-5">
              <ChartCardSkeleton tall />
            </div>
          </div>
        ) : (
          <OverviewCharts
            slices={slices}
            counterparts={counterparts}
            days={days}
            subjectLabel={subjectLabel}
          />
        )}

        <div className="mt-6 flex justify-end">
          <Link
            to={
              !isSelf && email
                ? `/debt-overview?person=${encodeURIComponent(email)}`
                : '/debt-overview'
            }
            className="btn-secondary"
          >
            Open {isSelf ? 'your' : `${firstName(name)}'s`} debts
          </Link>
        </div>

        <section className="mt-10">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-high">
              {isSelf
                ? 'Peers’ current debts'
                : `Open debts around ${firstName(name)}`}
            </h2>
            <span className="text-sm text-low">
              {peerDebts.length > 3 ? 'Top 3' : `${peerDebts.length} open`}
            </span>
          </div>

          {isLoading ? (
            <DebtGridSkeleton count={3} />
          ) : peerDebts.length === 0 ? (
            <div className="glass-card px-6 py-12 text-center">
              <p className="text-sm text-low">
                No open debts among peers right now.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {peerDebts.slice(0, 3).map((debt) => (
                <DebtCard
                  key={debt.id}
                  debt={debt}
                  faces={faces}
                  currentUserEmail={user?.email}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default Dashboard
