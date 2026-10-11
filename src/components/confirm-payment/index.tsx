import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Logo from '../logo'
import { formatRupee } from '../../lib/debt-utils'
import { confirmDebtPayment, getDebt } from '../../services/debts.service'
import { DEBT_STATUS, type Debt } from '../../types/debt'

const ConfirmPayment = () => {
  const { id = '' } = useParams()
  const [debt, setDebt] = useState<Debt | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    getDebt(id)
      .then((nextDebt) => {
        if (!cancelled) setDebt(nextDebt)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load this payment',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  const handleConfirm = async () => {
    if (!debt) return

    setIsConfirming(true)
    setError('')

    try {
      const closed = await confirmDebtPayment(debt)
      setDebt(closed)
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Could not confirm this payment',
      )
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <div className="page-shell">
      <header className="border-b border-white/50 bg-white/45 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Logo size="md" />
          <Link to="/login" className="btn-primary">
            Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <section className="glass-card p-6 sm:p-8">
          <p className="section-label">Payment confirmation</p>
          {isLoading ? (
            <p className="mt-4 text-sm text-low">Loading this karja...</p>
          ) : null}
          {error ? <p className="alert-error mt-4">{error}</p> : null}
          {!isLoading && !debt && !error ? (
            <p className="mt-4 text-sm text-medium">
              This payment link is not valid.
            </p>
          ) : null}
          {debt && debt.status === DEBT_STATUS.OPEN ? (
            <p className="mt-4 text-sm text-medium">
              Nobody has asked to close this karja yet.
            </p>
          ) : null}
          {debt && debt.status === DEBT_STATUS.CLOSED ? (
            <>
              <h1 className="mt-3 text-2xl font-semibold text-high">
                This payment is confirmed
              </h1>
              <p className="mt-3 text-sm text-medium">
                {debt.debtorName} paid {debt.creditorName}{' '}
                {formatRupee(debt.amount)}.
              </p>
            </>
          ) : null}
          {debt && debt.status === DEBT_STATUS.CLOSE_REQUESTED ? (
            <>
              <h1 className="mt-3 text-2xl font-semibold text-high">
                {debt.debtorName} says they paid you
              </h1>
              <p className="mt-3 text-3xl font-bold text-emerald-deep">
                {formatRupee(debt.amount)}
              </p>
              <p className="mt-3 text-sm text-medium">
                Confirm only if you have received this from {debt.debtorName}.
              </p>
              {debt.note ? (
                <p className="mt-2 text-sm text-low">Note: {debt.note}</p>
              ) : null}
              <button
                type="button"
                className="btn-primary mt-6"
                disabled={isConfirming}
                onClick={() => {
                  void handleConfirm()
                }}
              >
                {isConfirming ? 'Confirming...' : 'I received this payment'}
              </button>
            </>
          ) : null}
        </section>
      </main>
    </div>
  )
}

export default ConfirmPayment
