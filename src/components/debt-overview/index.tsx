import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import AppHeader from '../app-header'
import ConfirmModal from '../confirm-modal'
import DayRangeFilter from '../day-range-filter'
import DebtCard from '../debt-card'
import DebtFormModal from '../debt-form-modal'
import Pagination from '../pagination'
import SelectField from '../select-field'
import { DebtGridSkeleton } from '../skeleton'
import { DEBT_PAGE_SIZE } from '../../constants/pagination'
import { useAuth } from '../../hooks/use-auth'
import { usePeopleFaces } from '../../hooks/use-people-faces'
import { isSuperAdmin } from '../../lib/auth-utils'
import { copyTextToClipboard } from '../../lib/clipboard'
import {
  buildDebtShareText,
  debtInvolvesEmail,
  formatRupee,
} from '../../lib/debt-utils'
import { filterDebtsByDays, type DayRange } from '../../lib/leaderboard'
import { mergePeople } from '../../lib/overview-stats'
import { notifyDebtMail } from '../../services/mail.service'
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
  const reduceMotion = useReducedMotion()
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
  const [debtToDelete, setDebtToDelete] = useState<Debt | null>(null)
  const [debtToClose, setDebtToClose] = useState<Debt | null>(null)
  const [leaveTarget, setLeaveTarget] = useState<
    Record<string, { x: number; y: number }>
  >({})
  const [tabPulse, setTabPulse] = useState<FilterKey | null>(null)
  const filterRefs = useRef<Partial<Record<FilterKey, HTMLButtonElement>>>({})
  const cardRefs = useRef<Partial<Record<string, HTMLDivElement>>>({})
  const faces = usePeopleFaces(
    debts.flatMap((debt) => [debt.debtorEmail, debt.creditorEmail]),
  )

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

  const aimCardAtTab = (debtId: string, tab: FilterKey) => {
    const card = cardRefs.current[debtId]
    const target = filterRefs.current[tab]
    const offset = { x: 0, y: -72 }

    if (card && target) {
      const from = card.getBoundingClientRect()
      const to = target.getBoundingClientRect()
      offset.x = to.left + to.width / 2 - (from.left + from.width / 2)
      offset.y = to.top + to.height / 2 - (from.top + from.height / 2)
    }

    setLeaveTarget((current) => ({ ...current, [debtId]: offset }))
    setTabPulse(tab)
  }

  useEffect(() => {
    if (!tabPulse) return
    const timer = window.setTimeout(() => setTabPulse(null), 700)
    return () => window.clearTimeout(timer)
  }, [tabPulse])

  const runAction = async (work: () => Promise<unknown>, message: string) => {
    setActionLoading(true)
    setError('')
    setSuccess('')

    try {
      await work()
      await loadDebts()
      setSuccess(message)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
      return false
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
        const created = await createDebt(user, input)
        const mail = await notifyDebtMail('debt_created', created)
        setSuccess(
          mail.sent
            ? 'Debt added. Both people were emailed.'
            : `Debt added. ${mail.message}`,
        )
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
    return filterDebtsByDays(debts, range).filter((debt) => {
      if (!matchesFilter(debt, filter)) return false
      if (!personEmail) return true
      return debtInvolvesEmail(debt, personEmail)
    })
  }, [debts, filter, personEmail, range])

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
            : 'Ask to close what you will give. Close what you will get.'
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
                : 'Everyone’s debts'}
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
                  <motion.button
                    key={item.id}
                    ref={(node) => {
                      if (node) filterRefs.current[item.id] = node
                    }}
                    type="button"
                    onClick={() => {
                      setFilter(item.id)
                      setPage(1)
                    }}
                    animate={
                      tabPulse === item.id
                        ? { scale: [1, 1.08, 1] }
                        : { scale: 1 }
                    }
                    transition={{ duration: reduceMotion ? 0 : 0.45 }}
                    className={
                      filter === item.id ? 'filter-chip-active' : 'filter-chip'
                    }
                  >
                    {item.label}
                  </motion.button>
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
          ) : (
            <>
              {pagedDebts.length === 0 ? (
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
              ) : null}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence mode="popLayout" initial={false}>
                  {pagedDebts.map((debt) => {
                    const offset = leaveTarget[debt.id]

                    return (
                      <motion.div
                        key={debt.id}
                        layout
                        ref={(node) => {
                          if (node) cardRefs.current[debt.id] = node
                        }}
                        className="min-w-0"
                        style={{ zIndex: offset ? 30 : 1 }}
                        initial={false}
                        exit={
                          reduceMotion || !offset
                            ? { opacity: 0, transition: { duration: 0 } }
                            : {
                                x: offset.x,
                                y: offset.y,
                                scale: 0.14,
                                opacity: 0,
                                transition: {
                                  duration: 0.62,
                                  ease: [0.22, 1, 0.36, 1],
                                },
                              }
                        }
                      >
                        <DebtCard
                          debt={debt}
                          faces={faces}
                          currentUserEmail={user?.email}
                          isAdmin={isAdmin}
                          actionLoading={actionLoading}
                          onEdit={(next) => {
                            setEditingDebt(next)
                            setIsModalOpen(true)
                          }}
                          onDelete={setDebtToDelete}
                          onRequestClose={(next) => {
                            if (!user) return
                            aimCardAtTab(next.id, 'requested')
                            void (async () => {
                              let mailWarning = ''
                              const didSave = await runAction(async () => {
                                const updated = await requestDebtClose(
                                  next,
                                  user,
                                )
                                const mail = await notifyDebtMail(
                                  'payment_requested',
                                  updated,
                                )
                                if (!mail.sent) mailWarning = mail.message
                              }, 'Paid request sent. They were emailed to confirm.')
                              if (!didSave) {
                                setLeaveTarget((current) => {
                                  const nextTargets = { ...current }
                                  delete nextTargets[next.id]
                                  return nextTargets
                                })
                                return
                              }
                              if (mailWarning) {
                                setSuccess('')
                                setError(`Paid request saved. ${mailWarning}`)
                              }
                            })()
                          }}
                          onMarkClosed={setDebtToClose}
                          onReopen={(next) => {
                            if (!user) return
                            aimCardAtTab(next.id, 'open')
                            void runAction(
                              () =>
                                setDebtStatus(
                                  next.id,
                                  DEBT_STATUS.OPEN,
                                  user,
                                  isAdmin,
                                ),
                              'Moved back to open.',
                            ).then((didMove) => {
                              if (didMove) return
                              setLeaveTarget((current) => {
                                const nextTargets = { ...current }
                                delete nextTargets[next.id]
                                return nextTargets
                              })
                            })
                          }}
                        />
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </>
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

      <ConfirmModal
        isOpen={Boolean(debtToClose)}
        message={
          debtToClose
            ? `Close the ${formatRupee(debtToClose.amount)} debt where ${debtToClose.debtorName} ${debtToClose.status === DEBT_STATUS.CLOSE_REQUESTED ? 'is giving' : 'will give'} ${debtToClose.creditorName}? Both people will get an email.`
            : ''
        }
        confirmLabel="Mark closed"
        pendingLabel="Closing..."
        tone="primary"
        isConfirming={actionLoading}
        onCancel={() => {
          if (!actionLoading) setDebtToClose(null)
        }}
        onConfirm={() => {
          if (!debtToClose || !user) return
          const debt = debtToClose
          aimCardAtTab(debt.id, 'closed')
          setDebtToClose(null)
          void (async () => {
            let mailWarning = ''
            const didClose = await runAction(async () => {
              const updated = await setDebtStatus(
                debt.id,
                DEBT_STATUS.CLOSED,
                user,
                isAdmin,
              )
              const mail = await notifyDebtMail('debt_closed', updated)
              if (!mail.sent) mailWarning = mail.message
            }, 'Debt closed. Both people were emailed.')
            if (!didClose) {
              setLeaveTarget((current) => {
                const next = { ...current }
                delete next[debt.id]
                return next
              })
              return
            }
            if (mailWarning) {
              setSuccess('')
              setError(`Debt closed. ${mailWarning}`)
            }
          })()
        }}
      />

      <ConfirmModal
        isOpen={Boolean(debtToDelete)}
        message={
          debtToDelete
            ? `Delete the ${formatRupee(debtToDelete.amount)} debt where ${debtToDelete.debtorName} will give ${debtToDelete.creditorName}? This cannot be undone.`
            : ''
        }
        isConfirming={actionLoading}
        onCancel={() => {
          if (!actionLoading) setDebtToDelete(null)
        }}
        onConfirm={() => {
          if (!debtToDelete) return
          const debt = debtToDelete
          void runAction(() => deleteDebt(debt.id), 'Debt deleted.').then(
            (didDelete) => {
              if (didDelete) setDebtToDelete(null)
            },
          )
        }}
      />

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
