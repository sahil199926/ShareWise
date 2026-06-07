import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ExpenseSheetView from '../expense-sheet-view'
import Logo from '../logo'
import { useAuth } from '../../hooks/use-auth'
import { useShareMeta } from '../../hooks/use-share-meta'
import { useSharedExpenseSheet } from '../../hooks/use-shared-expense-sheet'
import { findSheetUserName } from '../../lib/sheet-user-utils'
import { buildShareCopyMessage } from '../../../lib/share-meta'
import { getEditSheetPath, getShareSheetUrl } from '../../lib/sheet-urls'
import {
  confirmPaymentStatus,
  requestPaymentStatus,
} from '../../services/expense-sheet.service'
import { applyThemeToDocument, getStoredTheme } from '../../lib/theme-storage'

const useSharePageLightTheme = () => {
  useEffect(() => {
    document.documentElement.classList.remove('dark')

    return () => {
      const stored = getStoredTheme() ?? 'dark'
      applyThemeToDocument(stored)
    }
  }, [])
}

type ShareSheetContentProps = {
  sheetId: string
}

const ShareSheetContent = ({ sheetId }: ShareSheetContentProps) => {
  const { user, isAuthenticated } = useAuth()
  const {
    data: sheetData,
    setData,
    error,
    isLoading,
  } = useSharedExpenseSheet(sheetId, user?.email)

  useShareMeta(sheetId, sheetData)
  const [copied, setCopied] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [paymentSuccess, setPaymentSuccess] = useState('')

  const currentSheetUser =
    sheetData && user?.name
      ? findSheetUserName(sheetData.users, user.name)
      : null

  const canManagePayments = sheetData?.permissions?.canManagePayments ?? false

  const handleRequestPayment = async () => {
    if (!user?.email) return

    setPaymentLoading(true)
    setPaymentError('')
    setPaymentSuccess('')

    try {
      const updated = await requestPaymentStatus(sheetId, user.email)
      setData(updated)
      setPaymentSuccess('Status updated to requested paid.')
    } catch (err) {
      setPaymentError(
        err instanceof Error ? err.message : 'Failed to request payment',
      )
    } finally {
      setPaymentLoading(false)
    }
  }

  const handleConfirmPayment = async (targetUser: string) => {
    if (!user?.email) return

    setPaymentLoading(true)
    setPaymentError('')
    setPaymentSuccess('')

    try {
      const updated = await confirmPaymentStatus(
        sheetId,
        user.email,
        targetUser,
      )
      setData(updated)
      setPaymentSuccess(`Marked ${targetUser} as paid.`)
    } catch (err) {
      setPaymentError(
        err instanceof Error ? err.message : 'Failed to confirm payment',
      )
    } finally {
      setPaymentLoading(false)
    }
  }

  const shareUrl = getShareSheetUrl(sheetId)

  const handleCopy = async () => {
    if (!sheetData) return

    const message = buildShareCopyMessage({
      sheetName: sheetData.name,
      shareUrl,
      users: sheetData.users,
      pending: sheetData.summary.pending,
      ownerName: sheetData.ownerName,
    })

    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="share-page min-h-screen bg-app">
      <header className="share-page-header border-b border-divider bg-surface">
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
        {paymentError ? <div className="alert-error">{paymentError}</div> : null}
        {paymentSuccess ? (
          <div className="alert-success">{paymentSuccess}</div>
        ) : null}

        {isLoading ? (
          <div className="space-y-4">
            <div className="skeleton h-28" />
            <div className="skeleton h-64" />
          </div>
        ) : sheetData ? (
          <div className="space-y-6">
            <div className="share-page-hero expense-hero card p-6 sm:p-8">
              <p className="section-label">Shared expense sheet</p>
              <h1 className="mt-2 text-2xl font-semibold text-high sm:text-3xl">
                {sheetData.name}
              </h1>
              <p className="mt-2 text-sm text-low">
                Anyone with this link can view balances and expenses. No sign-in
                required.
              </p>
              {sheetData.ownerName ? (
                <p className="mt-2 text-sm text-medium">
                  Owner: {sheetData.ownerName}
                </p>
              ) : null}

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
              currentSheetUser={isAuthenticated ? currentSheetUser : null}
              canManagePayments={canManagePayments}
              onRequestPayment={
                isAuthenticated && currentSheetUser
                  ? handleRequestPayment
                  : undefined
              }
              onConfirmPayment={
                canManagePayments ? handleConfirmPayment : undefined
              }
              paymentActionLoading={paymentLoading}
            />
          </div>
        ) : null}
      </main>

      <footer className="border-t border-divider py-6 text-center text-xs text-low">
        Powered by ShareWise A Eonlint Tech
      </footer>
    </div>
  )
}

const ShareSheet = () => {
  useSharePageLightTheme()

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
