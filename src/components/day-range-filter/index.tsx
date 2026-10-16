import { DAY_RANGES, type DayRange } from '../../lib/leaderboard'

type DayRangeFilterProps = {
  value: DayRange
  maxDays: number
  onChange: (value: DayRange) => void
}

const RANGE_LABELS: Record<DayRange, string> = {
  30: '30 days',
  60: '2 months',
  180: '6 months',
  365: '1 year',
  730: '2 years',
  3650: '10 years',
}

const DayRangeFilter = ({ value, maxDays, onChange }: DayRangeFilterProps) => {
  const availableRanges = DAY_RANGES.filter((option) => option <= maxDays)

  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Last days">
      {availableRanges.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={`${
            value === option ? 'filter-chip-active' : 'filter-chip'
          } px-2.5 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm`}
        >
          {RANGE_LABELS[option]}
        </button>
      ))}
    </div>
  )
}

export default DayRangeFilter
