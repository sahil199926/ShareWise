import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatRupee } from '../../lib/debt-utils'
import type {
  CounterpartBar,
  DayBar,
  StatusSlice,
} from '../../lib/overview-stats'
import { DEBT_STATUS } from '../../types/debt'

const STATUS_COLOR: Record<string, string> = {
  [DEBT_STATUS.OPEN]: '#16a34a',
  [DEBT_STATUS.CLOSE_REQUESTED]: '#d97706',
  [DEBT_STATUS.CLOSED]: '#94a3b8',
}

const GIVE_COLOR = '#dc2626'
const GET_COLOR = '#16a34a'
const AXIS = '#4d7c5f'
const GRID = 'rgba(22, 163, 74, 0.16)'

type OverviewChartsProps = {
  slices: StatusSlice[]
  counterparts: CounterpartBar[]
  days: DayBar[]
  subjectLabel: string
}

type TipRow = {
  name?: string
  value?: number | string
  color?: string
  payload?: { count?: number }
}

const RupeeTip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TipRow[]
  label?: string
}) => {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-2xl border border-white/80 bg-white/95 px-3 py-2 text-sm shadow-lg">
      {label ? <p className="mb-1 font-semibold text-high">{label}</p> : null}
      {payload.map((item) => (
        <p key={`${item.name}-${item.value}`} style={{ color: item.color }}>
          <span className="text-medium">{item.name}</span>{' '}
          <span className="font-semibold text-high">
            {formatRupee(Number(item.value ?? 0))}
          </span>
          {item.payload?.count ? (
            <span className="text-low"> · {item.payload.count}</span>
          ) : null}
        </p>
      ))}
    </div>
  )
}

const StatusRing = ({ slices }: { slices: StatusSlice[] }) => {
  const total = slices.reduce((sum, slice) => sum + slice.amount, 0)
  const pieSlices = slices.filter((slice) => slice.amount > 0)

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-52 w-full sm:h-56 sm:w-56">
        {pieSlices.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-low">
            No karja yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieSlices}
                dataKey="amount"
                nameKey="label"
                innerRadius="62%"
                outerRadius="88%"
                paddingAngle={3}
                stroke="transparent"
              >
                {pieSlices.map((slice) => (
                  <Cell key={slice.status} fill={STATUS_COLOR[slice.status]} />
                ))}
              </Pie>
              <Tooltip content={<RupeeTip />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <ul className="w-full space-y-3">
        {slices.map((slice) => (
          <li
            key={slice.status}
            className="flex items-center justify-between gap-3"
          >
            <span className="flex items-center gap-2 text-sm text-medium">
              <span
                className="size-2.5 rounded-full"
                style={{ background: STATUS_COLOR[slice.status] }}
              />
              {slice.label}
              <span className="text-low">{slice.count}</span>
            </span>
            <span className="text-sm font-semibold text-high">
              {formatRupee(slice.amount)}
            </span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-3 border-t border-divider pt-3">
          <span className="text-sm font-medium text-medium">Total</span>
          <span className="text-sm font-bold text-high">
            {formatRupee(total)}
          </span>
        </li>
      </ul>
    </div>
  )
}

const CounterpartChart = ({
  counterparts,
  subjectLabel,
}: {
  counterparts: CounterpartBar[]
  subjectLabel: string
}) => {
  if (counterparts.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-low">
        No open karja for {subjectLabel} yet.
      </p>
    )
  }

  return (
    <div
      className="w-full"
      style={{ height: Math.max(counterparts.length * 56, 180) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={counterparts}
          layout="vertical"
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          barGap={4}
        >
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={88}
            tick={{ fill: AXIS, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<RupeeTip />}
            cursor={{ fill: 'rgba(22,163,74,0.06)' }}
          />
          <Bar
            dataKey="willGive"
            name="Will give"
            fill={GIVE_COLOR}
            radius={[0, 8, 8, 0]}
            maxBarSize={14}
          />
          <Bar
            dataKey="willGet"
            name="Will get"
            fill={GET_COLOR}
            radius={[0, 8, 8, 0]}
            maxBarSize={14}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const DayChart = ({ days }: { days: DayBar[] }) => {
  if (days.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-low">
        New karja will show up here by the day it was added.
      </p>
    )
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={days} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: AXIS, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: AXIS, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(value: number) =>
              new Intl.NumberFormat('en-IN', {
                notation: 'compact',
                maximumFractionDigits: 1,
              }).format(value)
            }
          />
          <Tooltip
            content={<RupeeTip />}
            cursor={{ fill: 'rgba(22,163,74,0.06)' }}
          />
          <Bar
            dataKey="amount"
            name="Added"
            fill={GET_COLOR}
            radius={[10, 10, 0, 0]}
            maxBarSize={42}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const OverviewCharts = ({
  slices,
  counterparts,
  days,
  subjectLabel,
}: OverviewChartsProps) => {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
      <section className="glass-card p-5 lg:col-span-2">
        <p className="section-label">By status</p>
        <h2 className="mt-1 text-lg font-semibold text-high">
          Open, waiting, closed
        </h2>
        <div className="mt-4">
          <StatusRing slices={slices} />
        </div>
      </section>

      <section className="glass-card p-5 lg:col-span-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="section-label">With each person</p>
            <h2 className="mt-1 text-lg font-semibold text-high">
              Open give and get
            </h2>
          </div>
          <div className="flex gap-4 text-xs text-low">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[#dc2626]" />
              Will give
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-brand" />
              Will get
            </span>
          </div>
        </div>
        <div className="mt-4">
          <CounterpartChart
            counterparts={counterparts}
            subjectLabel={subjectLabel}
          />
        </div>
      </section>

      <section className="glass-card p-5 lg:col-span-5">
        <p className="section-label">Activity</p>
        <h2 className="mt-1 text-lg font-semibold text-high">Added by day</h2>
        <div className="mt-2">
          <DayChart days={days} />
        </div>
      </section>
    </div>
  )
}

export default OverviewCharts
