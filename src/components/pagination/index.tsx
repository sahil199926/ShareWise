import type { PaginationMeta } from '../../types/sheet'

type PaginationProps = {
  pagination: PaginationMeta
  onPageChange: (page: number) => void
  isLoading?: boolean
  itemLabel?: string
}

const Pagination = ({
  pagination,
  onPageChange,
  isLoading = false,
  itemLabel = 'items',
}: PaginationProps) => {
  const { page, pageSize, total, totalPages } = pagination
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  if (totalPages <= 1 && total === 0) {
    return null
  }

  return (
    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
      <p className="text-sm text-low">
        Showing {start}–{end} of {total} {itemLabel}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || isLoading}
          className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-50"
        >
          Previous
        </button>

        <span className="min-w-24 text-center text-sm text-medium">
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || isLoading}
          className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}

export default Pagination
