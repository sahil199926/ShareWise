import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatRupee } from '../../lib/debt-utils'
import {
  recentDayStats,
  type DayRange,
  type LeaderboardPerson,
} from '../../lib/leaderboard'
import type { DayStat } from '../../lib/leaderboard'
import type { Debt } from '../../types/debt'

type LeaderboardDetailProps = {
  person: LeaderboardPerson
  debts: Debt[]
  range: DayRange
}

const AXIS = '#4d7c5f'

const Tip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value?: number; name?: string; color?: string }[]
  label?: string
}) => {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-2xl border border-white/80 bg-white/95 px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-high">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="text-medium">
          {item.name}: {formatRupee(Number(item.value ?? 0))}
        </p>
      ))}
    </div>
  )
}

const ComparisonBar = ({ owe, receive }: { owe: number; receive: number }) => {
  const total = owe + receive
  const oweWidth = total > 0 ? (owe / total) * 100 : 50

  return (
    <div className="mt-4 flex h-6 overflow-hidden rounded-full bg-emerald/10">
      <div className="h-full bg-[#dc2626]" style={{ width: `${oweWidth}%` }} />
      <div className="h-full flex-1 bg-[#16a34a]" />
    </div>
  )
}

const DayChart = ({
  days,
  range,
  title,
  dataKey,
  color,
  empty,
}: {
  days: DayStat[]
  range: number
  title: string
  dataKey: 'owed' | 'received'
  color: string
  empty: string
}) => {
  const active = days.filter((day) => day[dataKey] > 0)
  const total = days.reduce((sum, day) => sum + day[dataKey], 0)

  return (
    <section className="glass-card p-5">
      <p className="section-label">
        {title} · last {range} days
      </p>
      <p className="mt-2 text-2xl font-bold text-high">{formatRupee(total)}</p>
      {active.length === 0 ? (
        <p className="mt-4 text-sm text-low">{empty}</p>
      ) : (
        <div className="mt-4 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={active} barCategoryGap="28%">
              <XAxis
                dataKey="label"
                tick={{ fill: AXIS, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                content={<Tip />}
                cursor={{ fill: 'rgba(22,163,74,0.08)' }}
              />
              <Bar
                dataKey={dataKey}
                name={dataKey === 'owed' ? 'Owed' : 'Receivable'}
                fill={color}
                radius={[10, 10, 4, 4]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

const LeaderboardDetail = ({
  person,
  debts,
  range,
}: LeaderboardDetailProps) => {
  const days = useMemo(
    () => recentDayStats(debts, person.email, range),
    [debts, person.email, range],
  )

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <section className="glass-card p-5">
          <p className="section-label">Contributions done</p>
          <p className="mt-2 text-4xl font-bold text-emerald-deep">
            {person.closedPaidCount}
          </p>
          <p className="mt-2 text-sm text-low">
            Settled {formatRupee(person.closedPaid)} across those payments.
          </p>
        </section>
        <section className="glass-card p-5">
          <p className="section-label">Paid back to them</p>
          <p className="mt-2 text-4xl font-bold text-high">
            {person.closedReceivedCount}
          </p>
          <p className="mt-2 text-sm text-low">
            Others already settled {formatRupee(person.closedReceived)}.
          </p>
        </section>
        <section className="glass-card p-5">
          <p className="section-label">Open comparison</p>
          <h3 className="mt-2 text-xl font-semibold text-high">
            {person.name}
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-[#dc2626]/10 p-5">
              <p className="text-sm font-medium text-[#b91c1c]">Will give</p>
              <p className="mt-2 text-3xl font-bold text-[#b91c1c] sm:text-4xl">
                {formatRupee(person.openOwe)}
              </p>
              <p className="mt-1 text-sm text-low">
                {person.openOweCount} open{' '}
                {person.openOweCount === 1 ? 'debt' : 'debts'}
              </p>
            </div>
            <div className="rounded-3xl bg-[#16a34a]/10 p-5">
              <p className="text-sm font-medium text-emerald-deep">Will get</p>
              <p className="mt-2 text-3xl font-bold text-emerald-deep sm:text-4xl">
                {formatRupee(person.openReceive)}
              </p>
              <p className="mt-1 text-sm text-low">
                {person.openReceiveCount} open{' '}
                {person.openReceiveCount === 1 ? 'debt' : 'debts'}
              </p>
            </div>
          </div>
          <ComparisonBar owe={person.openOwe} receive={person.openReceive} />
          <div className="mt-3 flex justify-between text-xs font-medium text-low">
            <span>Owed</span>
            <span>Receivable</span>
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6">
        <div className="glass-card p-5">
          <p className="section-label">Activity window</p>
          <p className="mt-2 text-2xl font-bold text-high">Last {range} days</p>
        </div>
        <DayChart
          days={days}
          range={range}
          title="Owed"
          dataKey="owed"
          color="#dc2626"
          empty={`No new debts to give in the last ${range} days.`}
        />
        <DayChart
          days={days}
          range={range}
          title="Receivable"
          dataKey="received"
          color="#16a34a"
          empty={`No new receivables in the last ${range} days.`}
        />
      </aside>
    </div>
  )
}

export default LeaderboardDetail
