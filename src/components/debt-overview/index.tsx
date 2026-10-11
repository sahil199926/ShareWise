import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AppHeader from '../app-header'
import DayRangeFilter from '../day-range-filter'
import DebtCard from '../debt-card'
import DebtFormModal from '../debt-form-modal'
import Pagination from '../pagination'
import SelectField from '../select-field'
import { DebtGridSkeleton } from '../skeleton'
import { DEBT_PAGE_SIZE } from '../../constants/pagination'
import { useAuth } from '../../hooks/use-auth'
import { isSuperAdmin } from '../../lib/auth-utils'
import { copyTextToClipboard } from '../../lib/clipboard'
import { buildDebtShareText, debtInvolvesEmail } from '../../lib/debt-utils'
import { filterDebtsByDays, type DayRange } from '../../lib/leaderboard'
import { mergePeople } from '../../lib/overview-stats'
import {
  createDebt,
  deleteDebt,
  listDebts,
  requestDebtClose,
  setDebtStatus,
  updateDebt,
} from '../../services/debts.service'
import { listMasterUserOptions } from '../../services/users.service'
import { DEBT_STATUS, type Debt, type DebtInput } from '../../types/debt'
import type { MasterUserOption } from '../../types/user-option'

type FilterKey = 'open' | 'requested' | 'closed'

const FILTERS: Array<{ id: FilterKey; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'requested', label: 'Waiting' },
  { id: 'closed', label: 'Closed' },
]

const matchesFilter = (debt: Debt, filter: FilterKey) => {
  if (filter === 'requested') return debt.status === DEBT_STATUS.CLOSE_REQUESTED
  if (filter === 'closed') return debt.status === DEBT_STATUS.CLOSED
  return debt.status === DEBT_STATUS.OPEN
}

const DebtOverview = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isAdmin = isSuperAdmin(user)
  const requestedPerson = searchParams.get('person') ?? ''
  const signedInEmail = user?.email ?? ''

  const [debts, setDebts] = useState<Debt[]>([])
  const [users, setUsers] = useState<MasterUserOption[]>([])
  const [filter, setFilter] = useState<FilterKey>('open')
  const [range, setRange] = useState<DayRange>(30)
  const [page, setPage] = useState(1)
  const [personEmail, setPersonEmail] = useState(
    requestedPerson || signedInEmail,
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingDebt, setEditingDebt] = useState<Debt | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shareText, setShareText] = useState('')

  const loadDebts = useCallback(async () => {
    const nextDebts = await listDebts()
    setDebts(nextDebts)
  }, [])

  useEffect(() => {
    setPersonEmail(requestedPerson || signedInEmail)
  }, [requestedPerson, signedInEmail])

  useEffect(() => {
    if (!user?.email) return

    let cancelled = false

    const loadPeople = isAdmin
      ? listMasterUserOptions(user.email)
          .then((nextUsers) => {
            if (!cancelled) setUsers(nextUsers)
          })
          .catch((err) => {
            if (!cancelled) {
              setError(
                err instanceof Error ? err.message : 'Failed to load people',
              )
            }
          })
      : Promise.resolve()

    const loadKarja = listDebts()
      .then((nextDebts) => {
        if (cancelled) return
        setDebts(nextDebts)
        setError('')
      })
      .catch((err) => {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : 'Failed to load debts'
        setError(
          message.includes('public.debts')
            ? 'Debts table is missing in Supabase. Open the SQL editor and run supabase/schema.sql, then refresh.'
            : message,
        )
      })

    Promise.all([loadPeople, loadKarja]).finally(() => {
      if (!cancelled) setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [isAdmin, user?.email])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const runAction = async (work: () => Promise<unknown>, message: string) => {
    setActionLoading(true)
    setError('')
    setSuccess('')

    try {
      await work()
      await loadDebts()
      setSuccess(message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSaveDebt = async (input: DebtInput) => {
    if (!user) return

    setIsSubmitting(true)
    setError('')

    try {
      if (editingDebt) {
        await updateDebt(editingDebt.id, input)
        setSuccess('Debt updated.')
      } else {
        await createDebt(user, input)
        setSuccess('Debt added.')
      }
      await loadDebts()
      setIsModalOpen(false)
      setEditingDebt(undefined)
    } finally {
      setIsSubmitting(false)
    }
  }

  const people = useMemo(() => {
    const self =
      user?.email && user.name ? [{ name: user.name, email: user.email }] : []
    const mine = user?.email
      ? debts.filter((debt) => debtInvolvesEmail(debt, user.email))
      : []

    return mergePeople(
      isAdmin ? [...users, ...self] : self,
      isAdmin ? debts : mine,
    )
  }, [debts, isAdmin, user?.email, user?.name, users])

  const selectedPerson = people.find(
    (person) =>
      person.email.trim().toLowerCase() === personEmail.trim().toLowerCase(),
  )

  const visibleDebts = useMemo(() => {
    const scoped = isAdmin
      ? debts
      : debts.filter((debt) =>
          user?.email ? debtInvolvesEmail(debt, user.email) : false,
        )

    return filterDebtsByDays(scoped, range).filter((debt) => {
      if (!matchesFilter(debt, filter)) return false
      if (!personEmail) return true
      return debtInvolvesEmail(debt, personEmail)
    })
  }, [debts, filter, isAdmin, personEmail, range, user?.email])

  const totalPages = Math.max(
    1,
    Math.ceil(visibleDebts.length / DEBT_PAGE_SIZE),
  )
  const currentPage = Math.min(page, totalPages)
  const pagedDebts = visibleDebts.slice(
    (currentPage - 1) * DEBT_PAGE_SIZE,
    currentPage * DEBT_PAGE_SIZE,
  )

  return (
    <div className="page-shell">
      <AppHeader
        title="Debts"
        subtitle={
          isAdmin
            ? 'Filter by person, then add, edit, or close a karja.'
            : 'Your debts, filtered by the other person.'
        }
        onLogout={handleLogout}
        navAside={
          <DayRangeFilter
            value={range}
            onChange={(next) => {
              setRange(next)
              setPage(1)
            }}
          />
        }
        actions={
          isAdmin ? (
            <button
              type="button"
              onClick={() => {
                setEditingDebt(undefined)
                setIsModalOpen(true)
              }}
              className="btn-primary"
            >
              Add debt
            </button>
          ) : null
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error ? <div className="alert-error mb-6">{error}</div> : null}
        {success ? <div className="alert-success mb-6">{success}</div> : null}

        <section>
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-lg font-semibold text-high">
              {selectedPerson
                ? `${selectedPerson.name}'s debts`
                : isAdmin
                  ? 'Everyone’s debts'
                  : 'Your debts'}
            </h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <SelectField
                ariaLabel="Filter by person"
                className="mt-0 w-full sm:w-48"
                value={selectedPerson?.email ?? ''}
                onChange={(email) => {
                  setPersonEmail(email)
                  setPage(1)
                }}
                options={[
                  { value: '', label: 'Everyone' },
                  ...people.map((person) => ({
                    value: person.email,
                    label: person.name,
                  })),
                ]}
              />
              {selectedPerson ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const url = `${window.location.origin}/share/${encodeURIComponent(selectedPerson.email.trim().toLowerCase())}`
                    const text = buildDebtShareText({
                      debts: debts.filter(
                        (debt) => debt.status === DEBT_STATUS.OPEN,
                      ),
                      email: selectedPerson.email,
                      name: selectedPerson.name,
                      url,
                    })
                    const markCopied = () => {
                      setShareText('')
                      setCopied(true)
                      window.setTimeout(() => setCopied(false), 2000)
                    }
                    const revealText = () => {
                      setCopied(false)
                      setShareText(text)
                    }

                    void copyTextToClipboard(text).then((didCopy) => {
                      if (didCopy) markCopied()
                      else revealText()
                    })
                  }}
                >
                  {copied ? 'Summary copied' : 'Copy share message'}
                </button>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setFilter(item.id)
                      setPage(1)
                    }}
                    className={
                      filter === item.id ? 'filter-chip-active' : 'filter-chip'
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {shareText ? (
            <div className="glass-card mb-5 p-4">
              <p className="text-sm font-medium text-high">
                Copy this share message:
              </p>
              <pre className="mt-2 whitespace-pre-wrap text-sm text-medium">
                {shareText}
              </pre>
            </div>
          ) : null}

          {isLoading ? (
            <DebtGridSkeleton />
          ) : pagedDebts.length === 0 ? (
            <div className="glass-card px-6 py-16 text-center">
              <p className="text-sm font-medium text-medium">
                No debts in this view
              </p>
              <p className="mt-1 text-sm text-low">
                {isAdmin
                  ? 'Add a karja, or pick another person.'
                  : 'Nothing here for this filter yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pagedDebts.map((debt) => (
                <DebtCard
                  key={debt.id}
                  debt={debt}
                  currentUserEmail={user?.email}
                  isAdmin={isAdmin}
                  actionLoading={actionLoading}
                  onEdit={(next) => {
                    setEditingDebt(next)
                    setIsModalOpen(true)
                  }}
                  onDelete={(next) => {
                    if (!window.confirm(`Delete ${next.debtorName}'s debt?`)) {
                      return
                    }
                    void runAction(() => deleteDebt(next.id), 'Debt deleted.')
                  }}
                  onRequestClose={(next) => {
                    if (!user) return
                    void runAction(
                      () => requestDebtClose(next, user),
                      'Asked admin to close this debt.',
                    )
                  }}
                  onMarkClosed={(next) => {
                    if (!user) return
                    void runAction(
                      () => setDebtStatus(next.id, DEBT_STATUS.CLOSED, user),
                      `Closed ${next.debtorName}'s debt.`,
                    )
                  }}
                  onReopen={(next) => {
                    if (!user) return
                    void runAction(
                      () => setDebtStatus(next.id, DEBT_STATUS.OPEN, user),
                      'Debt reopened.',
                    )
                  }}
                />
              ))}
            </div>
          )}

          {pagedDebts.length > 0 ? (
            <div className="mt-6">
              <Pagination
                itemLabel="debts"
                pagination={{
                  page: currentPage,
                  pageSize: DEBT_PAGE_SIZE,
                  total: visibleDebts.length,
                  totalPages,
                }}
                onPageChange={setPage}
              />
            </div>
          ) : null}
        </section>
      </main>

      {isAdmin ? (
        <DebtFormModal
          isOpen={isModalOpen}
          mode={editingDebt ? 'edit' : 'create'}
          debt={editingDebt}
          users={users}
          isSubmitting={isSubmitting}
          onClose={() => {
            setIsModalOpen(false)
            setEditingDebt(undefined)
          }}
          onSubmit={handleSaveDebt}
        />
      ) : null}
    </div>
  )
}

export default DebtOverview
