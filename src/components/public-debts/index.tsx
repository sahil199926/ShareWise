import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DebtCard from '../debt-card'
import Logo from '../logo'
import { DebtGridSkeleton } from '../skeleton'
import { copyTextToClipboard } from '../../lib/clipboard'
import {
  buildDebtShareText,
  debtInvolvesEmail,
  formatRupee,
  getOpenDebtTotals,
} from '../../lib/debt-utils'
import { setShareMeta, shareCopy } from '../../lib/share-copy'
import { getSharedDebts } from '../../services/debts.service'
import { DEBT_STATUS, type Debt } from '../../types/debt'

const PublicDebts = () => {
  const { token = '' } = useParams()
  const [debts, setDebts] = useState<Debt[]>([])
  const [person, setPerson] = useState({ name: '', email: '' })
  const [expiresAt, setExpiresAt] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  useEffect(() => {
    let cancelled = false

    getSharedDebts(token)
      .then((result) => {
        if (!cancelled) {
          setDebts(result.debts)
          setPerson(result.person)
          setExpiresAt(result.expiresAt)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load debts')
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token])

  const email = person.email.trim().toLowerCase()

  const openDebts = useMemo(() => {
    return debts.filter(
      (debt) =>
        debt.status === DEBT_STATUS.OPEN && debtInvolvesEmail(debt, email),
    )
  }, [debts, email])

  const name = person.name || 'Shared debts'
  const totals = useMemo(
    () => getOpenDebtTotals(openDebts, email),
    [email, openDebts],
  )

  useEffect(() => {
    if (isLoading || !person.name) return
    const copy = shareCopy({
      name,
      openOwe: totals.toGive,
      openReceive: totals.toReceive,
      openOweCount: openDebts.filter(
        (debt) => debt.debtorEmail.trim().toLowerCase() === email,
      ).length,
      openReceiveCount: openDebts.filter(
        (debt) => debt.creditorEmail.trim().toLowerCase() === email,
      ).length,
    })
    return setShareMeta(copy.title, copy.description)
  }, [
    email,
    isLoading,
    name,
    openDebts,
    person.name,
    totals.toGive,
    totals.toReceive,
  ])

  const handleCopySummary = () => {
    const text = buildDebtShareText({
      debts: openDebts,
      email,
      name,
      url: window.location.href,
    })

    setCopyError(false)
    void copyTextToClipboard(text).then((didCopy) => {
      if (!didCopy) {
        setCopyError(true)
        return
      }

      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="page-shell">
      <header className="border-b border-white/50 bg-white/45 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Logo size="md" />
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/leaderboard" className="btn-ghost">
              Leaderboard
            </Link>
            <Link to="/login" className="btn-primary">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="section-label">Public link</p>
        <h1 className="mt-1 text-2xl font-semibold text-high sm:text-3xl">
          {`${name}'s open karja`}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-low">
          Anyone with this signed link can see the debts that are still open
          {expiresAt
            ? ` until ${new Date(expiresAt).toLocaleString('en-IN')}.`
            : '.'}
        </p>

        {!isLoading && !error ? (
          <section
            className="glass-card mt-6 p-5"
            aria-label="Open debt totals"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="section-label">Total to give</p>
                <p className="mt-1 text-2xl font-bold text-danger">
                  {formatRupee(totals.toGive)}
                </p>
              </div>
              <div>
                <p className="section-label">Total to receive</p>
                <p className="mt-1 text-2xl font-bold text-emerald-deep">
                  {formatRupee(totals.toReceive)}
                </p>
              </div>
              <div>
                <p className="section-label">Net balance</p>
                <p className="mt-1 text-2xl font-bold text-high">
                  {totals.net === 0
                    ? 'Settled'
                    : formatRupee(Math.abs(totals.net))}
                </p>
                {totals.net !== 0 ? (
                  <p className="mt-1 text-xs text-low">
                    {totals.net > 0 ? 'to give' : 'to receive'}
                  </p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary mt-5"
              onClick={handleCopySummary}
            >
              {copied ? 'Summary copied' : 'Copy summary'}
            </button>
            {copyError ? (
              <p className="mt-2 text-sm text-danger">
                Could not copy. Please copy the page URL from your browser.
              </p>
            ) : null}
          </section>
        ) : null}

        {error ? <div className="alert-error mt-6">{error}</div> : null}

        <section className="mt-8">
          {isLoading ? (
            <DebtGridSkeleton />
          ) : openDebts.length === 0 ? (
            <div className="glass-card px-6 py-16 text-center">
              <p className="text-sm font-medium text-medium">
                No open debts for this person
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {openDebts.map((debt) => (
                <DebtCard
                  key={debt.id}
                  debt={debt}
                  faces={{}}
                  currentUserEmail={email}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default PublicDebts
