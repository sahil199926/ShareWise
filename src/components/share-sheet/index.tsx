import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppHeader from '../app-header'
import ExpenseSheetView from '../expense-sheet-view'
import { useAuth } from '../../hooks/use-auth'
import { useExpenseSheet } from '../../hooks/use-expense-sheet'
import { getEditSheetPath, getShareSheetUrl } from '../../lib/sheet-urls'

type ShareSheetContentProps = {
  sheetId: string
  requesterEmail: string
}

const ShareSheetContent = ({
  sheetId,
  requesterEmail,
}: ShareSheetContentProps) => {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const {
    data: sheetData,
    error,
    isLoading,
  } = useExpenseSheet(sheetId, requesterEmail)
  const [copied, setCopied] = useState(false)

  const shareUrl = getShareSheetUrl(sheetId)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="page-shell">
      <AppHeader title="Share sheet" onLogout={handleLogout} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/dashboard" className="text-sm font-medium text-accent">
            ← Back to dashboard
          </Link>

          <Link
            to={getEditSheetPath(sheetId)}
            state={{ sheet: { id: sheetId, name: sheetData?.name ?? '' } }}
            className="btn-secondary"
          >
            Edit sheet
          </Link>
        </div>

        {error ? <div className="alert-error mt-6">{error}</div> : null}

        {isLoading ? (
          <div className="mt-6 space-y-4">
            <div className="skeleton h-28" />
            <div className="skeleton h-64" />
          </div>
        ) : sheetData ? (
          <div className="mt-6 space-y-6">
            <div className="expense-hero card p-6 sm:p-8">
              <p className="section-label">Shared expense sheet</p>
              <h2 className="mt-2 text-2xl font-semibold text-high sm:text-3xl">
                {sheetData.name}
              </h2>
              <p className="mt-2 text-sm text-low">
                Read-only view synced from Google Sheets.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="input-field font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="btn-primary shrink-0 px-6"
                >
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
              </div>
            </div>

            <ExpenseSheetView
              data={sheetData}
              mode="view"
              summary={sheetData.summary}
            />
          </div>
        ) : null}
      </main>
    </div>
  )
}

const ShareSheet = () => {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  if (!id || !user?.email) {
    return null
  }

  return <ShareSheetContent key={id} sheetId={id} requesterEmail={user.email} />
}

export default ShareSheet
