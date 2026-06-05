import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppHeader from '../app-header'
import ExpenseSheetView from '../expense-sheet-view'
import { useAuth } from '../../hooks/use-auth'
import { useExpenseSheet } from '../../hooks/use-expense-sheet'
import {
  computeLiveSummary,
  getDraftItemsForSummary,
  toExpenseSheetDraft,
} from '../../lib/expense-sheet-utils'
import { getShareSheetPath } from '../../lib/sheet-urls'
import { updateExpenseSheet } from '../../services/expense-sheet.service'
import type { ExpenseSheetUpdateInput } from '../../types/expense-sheet'

type EditSheetContentProps = {
  sheetId: string
  requesterEmail: string
}

const EditSheetContent = ({
  sheetId,
  requesterEmail,
}: EditSheetContentProps) => {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const {
    data: sheetData,
    error,
    isLoading,
  } = useExpenseSheet(sheetId, requesterEmail)

  const [draft, setDraft] = useState<ExpenseSheetUpdateInput | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (sheetData) {
      setDraft(toExpenseSheetDraft(sheetData))
    }
  }, [sheetData])

  const liveSummary = useMemo(() => {
    if (!sheetData || !draft) return null

    return computeLiveSummary(
      sheetData.users,
      getDraftItemsForSummary(sheetData, draft),
      draft.given,
    )
  }, [sheetData, draft])

  const handleSave = async () => {
    if (!draft) return

    setIsSaving(true)
    setSaveError('')
    setSuccess('')

    try {
      const updated = await updateExpenseSheet(sheetId, requesterEmail, draft)
      setDraft(toExpenseSheetDraft(updated))
      setSuccess('Changes saved to Google Sheets.')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save sheet')
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

          <Link
            to={getShareSheetPath(sheetId)}
            state={{ sheet: { id: sheetId, name: sheetData?.name ?? '' } }}
            className="btn-secondary"
          >
            Share view
          </Link>
        </div>

        {error ? <div className="alert-error mt-6">{error}</div> : null}
        {saveError ? <div className="alert-error mt-6">{saveError}</div> : null}
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

const EditSheet = () => {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  if (!id || !user?.email) {
    return null
  }

  return <EditSheetContent key={id} sheetId={id} requesterEmail={user.email} />
}

export default EditSheet
