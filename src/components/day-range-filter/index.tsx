import { DAY_RANGES, type DayRange } from '../../lib/leaderboard'

type DayRangeFilterProps = {
  value: DayRange
  onChange: (value: DayRange) => void
}

const DayRangeFilter = ({ value, onChange }: DayRangeFilterProps) => {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Last days">
      {DAY_RANGES.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={value === option ? 'filter-chip-active' : 'filter-chip'}
        >
          {option} days
        </button>
      ))}
    </div>
  )
}

export default DayRangeFilter
