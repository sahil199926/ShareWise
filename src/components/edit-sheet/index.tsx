import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppHeader from '../app-header'
import ExpenseSheetView from '../expense-sheet-view'
import { useAuth } from '../../hooks/use-auth'
import {
  computeLiveSummary,
  getDraftItemsForSummary,
  toExpenseSheetDraft,
} from '../../lib/expense-sheet-utils'
import { getShareSheetPath } from '../../lib/sheet-urls'
import {
  getExpenseSheet,
  updateExpenseSheet,
} from '../../services/expense-sheet.service'
import type { ExpenseSheetData } from '../../types/expense-sheet'
import type { ExpenseSheetUpdateInput } from '../../types/expense-sheet'

const EditSheet = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [sheetData, setSheetData] = useState<ExpenseSheetData | null>(null)
  const [draft, setDraft] = useState<ExpenseSheetUpdateInput | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!id || !user?.email) return

    setIsLoading(true)

    getExpenseSheet(id, user.email)
      .then((sheet) => {
        setSheetData(sheet)
        setDraft(toExpenseSheetDraft(sheet))
        setError('')
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load sheet')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [id, user?.email])

  const liveSummary = useMemo(() => {
    if (!sheetData || !draft) return null

    return computeLiveSummary(
      sheetData.users,
      getDraftItemsForSummary(sheetData, draft),
      draft.given,
    )
  }, [sheetData, draft])

  const handleSave = async () => {
    if (!id || !user?.email || !draft) return

    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      const updated = await updateExpenseSheet(id, user.email, draft)
      setSheetData(updated)
      setDraft(toExpenseSheetDraft(updated))
      setSuccess('Changes saved to Google Sheets.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sheet')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="page-shell">
      <AppHeader
        title="Edit sheet"
        onLogout={handleLogout}
        actions={
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading || !draft}
            className="btn-primary"
          >
            {isSaving ? 'Saving...' : 'Save changes'}
          </button>
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/dashboard" className="text-sm font-medium text-accent">
            ← Back to dashboard
          </Link>

          {id ? (
            <Link
              to={getShareSheetPath(id)}
              state={{ sheet: { id, name: sheetData?.name ?? '' } }}
              className="btn-secondary"
            >
              Share view
            </Link>
          ) : null}
        </div>

        {error ? <div className="alert-error mt-6">{error}</div> : null}
        {success ? <div className="alert-success mt-6">{success}</div> : null}

        {isLoading ? (
          <div className="mt-6 space-y-4">
            <div className="skeleton h-28" />
            <div className="skeleton h-64" />
          </div>
        ) : sheetData && draft && liveSummary ? (
          <div className="mt-6 space-y-6">
            <div className="card p-6 sm:p-8">
              <p className="section-label">Sheet editor</p>
              <h2 className="mt-2 text-2xl font-semibold text-high sm:text-3xl">
                {sheetData.name}
              </h2>
              <p className="mt-2 text-sm text-low">
                Update shares, given amounts, paid by, and comments. Totals and
                pending recalculate automatically.
              </p>
            </div>

            <ExpenseSheetView
              data={sheetData}
              mode="edit"
              summary={liveSummary}
              draft={draft}
              onDraftChange={setDraft}
            />
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default EditSheet
