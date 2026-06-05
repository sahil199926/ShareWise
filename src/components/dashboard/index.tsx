import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../app-header'
import CreateSheetModal from '../create-sheet-modal'
import Pagination from '../pagination'
import SheetCard from '../sheet-card'
import { useAuth } from '../../hooks/use-auth'
import { canEditSheet } from '../../lib/sheet-permissions'
import { createSheet, listSheets } from '../../services/sheets.service'
import type {
  CreateSheetInput,
  PaginationMeta,
  SheetItem,
} from '../../types/sheet'

const Dashboard = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [sheets, setSheets] = useState<SheetItem[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const reloadSheets = useCallback((page: number) => {
    listSheets(page)
      .then((result) => {
        setSheets(result.sheets)
        setPagination(result.pagination)
        setError('')
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load sheets')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  useEffect(() => {
    reloadSheets(currentPage)
  }, [currentPage, reloadSheets])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handlePageChange = (page: number) => {
    setIsLoading(true)
    setCurrentPage(page)
  }

  const handleCreateSheet = async (input: CreateSheetInput) => {
    if (!user?.email) return

    setIsCreating(true)
    setIsLoading(true)

    try {
      await createSheet(user.email, input)
      setCurrentPage(1)
      reloadSheets(1)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="page-shell">
      <AppHeader
        title="Dashboard"
        onLogout={handleLogout}
        actions={
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="btn-primary"
          >
            Create new sheet
          </button>
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="card p-6 sm:p-8">
          <h2 className="text-lg font-medium text-high">
            Welcome back, {user?.name}
          </h2>
          <p className="mt-2 text-sm text-low">
            All sheets in your workbook except MASTER.
          </p>
        </div>

        <section className="mt-8">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-base font-semibold text-high">Your sheets</h3>
            {!isLoading ? (
              <span className="text-sm text-low">{pagination.total} total</span>
            ) : null}
          </div>

          {error ? <div className="alert-error">{error}</div> : null}

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="skeleton h-24" />
              ))}
            </div>
          ) : sheets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-divider bg-surface px-6 py-12 text-center">
              <p className="text-sm font-medium text-medium">No sheets yet</p>
              <p className="mt-1 text-sm text-low">
                Create your first sheet to get started.
              </p>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="btn-primary mt-4"
              >
                Create new sheet
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {sheets.map((sheet) => (
                <SheetCard
                  key={sheet.id}
                  sheet={sheet}
                  canEdit={canEditSheet(sheet, user)}
                />
              ))}
            </div>
          )}

          {!isLoading && sheets.length > 0 ? (
            <div className="mt-8">
              <Pagination
                pagination={pagination}
                onPageChange={handlePageChange}
                isLoading={isLoading}
                itemLabel="sheets"
              />
            </div>
          ) : null}
        </section>
      </main>

      <CreateSheetModal
        isOpen={isModalOpen}
        isSubmitting={isCreating}
        requesterEmail={user?.email ?? ''}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateSheet}
      />
    </div>
  )
}

export default Dashboard
