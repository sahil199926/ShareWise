import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ExpenseSheetView from '../expense-sheet-view'
import Logo from '../logo'
import { useAuth } from '../../hooks/use-auth'
import { useSharedExpenseSheet } from '../../hooks/use-shared-expense-sheet'
import { getEditSheetPath, getShareSheetUrl } from '../../lib/sheet-urls'

type ShareSheetContentProps = {
  sheetId: string
}

const ShareSheetContent = ({ sheetId }: ShareSheetContentProps) => {
  const { isAuthenticated } = useAuth()
  const { data: sheetData, error, isLoading } = useSharedExpenseSheet(sheetId)
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

  return (
    <div className="share-page min-h-screen bg-app">
      <header className="border-b border-divider bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Logo size="md" />
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald/15 px-3 py-1 text-xs font-medium text-emerald-light">
              Read-only
            </span>
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn-ghost text-sm">
                Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                state={{ from: { pathname: getEditSheetPath(sheetId) } }}
                className="btn-ghost text-sm"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error ? <div className="alert-error">{error}</div> : null}

        {isLoading ? (
          <div className="space-y-4">
            <div className="skeleton h-28" />
            <div className="skeleton h-64" />
          </div>
        ) : sheetData ? (
          <div className="space-y-6">
            <div className="expense-hero card p-6 sm:p-8">
              <p className="section-label">Shared expense sheet</p>
              <h1 className="mt-2 text-2xl font-semibold text-high sm:text-3xl">
                {sheetData.name}
              </h1>
              <p className="mt-2 text-sm text-low">
                Anyone with this link can view balances and expenses. No sign-in
                required.
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

      <footer className="border-t border-divider py-6 text-center text-xs text-low">
        Powered by ShareWise
      </footer>
    </div>
  )
}

const ShareSheet = () => {
  const { id } = useParams<{ id: string }>()

  if (!id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-4">
        <p className="text-sm text-low">Invalid share link.</p>
      </div>
    )
  }

  return <ShareSheetContent key={id} sheetId={id} />
}

export default ShareSheet
