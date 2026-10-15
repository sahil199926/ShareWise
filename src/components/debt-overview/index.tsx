import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import AppHeader from '../app-header'
import ConfirmModal from '../confirm-modal'
import DayRangeFilter from '../day-range-filter'
import DebtCard from '../debt-card'
import DebtFormModal from '../debt-form-modal'
import ExpenseFormModal from '../expense-form-modal'
import Pagination from '../pagination'
import SelectField from '../select-field'
import SheetSyncModal from '../sheet-sync-modal'
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
import type { DayRange } from '../../lib/leaderboard'
import { mergePeople } from '../../lib/overview-stats'
import { notifyDebtMail, notifyExpenseMail } from '../../services/mail.service'
import {
  createDebt,
  createDebtShareToken,
  createExpenseDebts,
  deleteDebt,
  listDebtPage,
  requestDebtClose,
  setDebtStatus,
  updateDebt,
} from '../../services/debts.service'
import { createSheetImportDebts } from '../../services/sheet-sync.service'
import { listMasterUserOptions } from '../../services/users.service'
import { DEBT_STATUS, type Debt, type DebtInput } from '../../types/debt'
import type { ExpenseSubmission } from '../../types/expense'
import type { SheetSyncSubmission } from '../../types/sheet-sync'
import type { MasterUserOption } from '../../types/user-option'
import type { PaginationMeta } from '../../types/pagination'

type FilterKey = 'open' | 'requested' | 'closed'

const FILTERS: Array<{ id: FilterKey; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'requested', label: 'Waiting' },
  { id: 'closed', label: 'Closed' },
]

const DebtOverview = () => {
  const reduceMotion = useReducedMotion()
  const { user, activeGroup, logout } = useAuth()
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
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: DEBT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  })
  const [personEmail, setPersonEmail] = useState(
    requestedPerson || signedInEmail,
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [isSheetSyncOpen, setIsSheetSyncOpen] = useState(false)
  const [editingDebt, setEditingDebt] = useState<Debt | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shareText, setShareText] = useState('')
  const [debtToDelete, setDebtToDelete] = useState<Debt | null>(null)
  const [debtToRequest, setDebtToRequest] = useState<Debt | null>(null)
  const [debtToClose, setDebtToClose] = useState<Debt | null>(null)
  const [debtToReopen, setDebtToReopen] = useState<Debt | null>(null)
  const [leaveTarget, setLeaveTarget] = useState<
    Record<string, { x: number; y: number }>
  >({})
  const [tabPulse, setTabPulse] = useState<FilterKey | null>(null)
  const filterRefs = useRef<Partial<Record<FilterKey, HTMLButtonElement>>>({})
  const cardRefs = useRef<Partial<Record<string, HTMLDivElement>>>({})
  const faces = usePeopleFaces(
    debts.flatMap((debt) => [debt.debtorEmail, debt.creditorEmail]),
  )

  const selectedPersonId =
    personEmail.trim().toLowerCase() === user?.email.trim().toLowerCase()
      ? (user?.id ?? null)
      : (users.find(
          (person) =>
            person.email.trim().toLowerCase() ===
            personEmail.trim().toLowerCase(),
        )?.id ?? null)
  const selectedStatus =
    filter === 'requested'
      ? DEBT_STATUS.CLOSE_REQUESTED
      : filter === 'closed'
        ? DEBT_STATUS.CLOSED
        : DEBT_STATUS.OPEN

  const loadDebts = useCallback(async () => {
    if (!activeGroup) return
    const result = await listDebtPage(activeGroup.id, {
      page,
      pageSize: DEBT_PAGE_SIZE,
      status: selectedStatus,
      personId: personEmail ? selectedPersonId : null,
      days: range,
    })
    setDebts(result.debts)
    setPagination(result.pagination)
  }, [activeGroup, page, personEmail, range, selectedPersonId, selectedStatus])

  useEffect(() => {
    const timer = window.setTimeout(
      () => setPersonEmail(requestedPerson || signedInEmail),
      0,
    )
    return () => window.clearTimeout(timer)
  }, [requestedPerson, signedInEmail])

  useEffect(() => {
    if (!user?.email || !activeGroup) return

    let cancelled = false

    const loadPeople = isAdmin
      ? listMasterUserOptions(activeGroup.id)
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

    loadPeople.finally(() => {
      if (!cancelled) setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [activeGroup, isAdmin, user?.email])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDebts()
        .then(() => setError(''))
        .catch((err) =>
          setError(err instanceof Error ? err.message : 'Failed to load debts'),
        )
        .finally(() => setIsLoading(false))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadDebts])

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
    if (!user || !activeGroup) return

    setIsSubmitting(true)
    setError('')

    try {
      if (editingDebt) {
        await updateDebt(activeGroup.id, editingDebt.id, input)
        setSuccess('Debt updated.')
      } else {
        const created = await createDebt(activeGroup.id, input)
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

  const handleCreateExpense = async (input: ExpenseSubmission) => {
    if (!user || !activeGroup) return

    setIsSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const created = await createExpenseDebts(activeGroup.id, input)
      const mail = await notifyExpenseMail(input, created)
      setSuccess(
        mail.sent
          ? `Expense created. ${created.length} ${created.length === 1 ? 'debt' : 'debts'} added and ${mail.count} ${mail.count === 1 ? 'person was' : 'people were'} emailed.`
          : `Expense created. ${created.length} ${created.length === 1 ? 'debt was' : 'debts were'} added. ${mail.message}`,
      )
      await loadDebts()
      setIsExpenseModalOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSheetSync = async (input: SheetSyncSubmission) => {
    if (!user) return

    setIsSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const created = await createSheetImportDebts(activeGroup!.id, input)
      const mail = await notifyExpenseMail(
        {
          note: input.note,
          expenseDate: input.expenseDate,
          totalAmount: created.reduce((sum, debt) => sum + debt.amount, 0),
        },
        created,
      )
      setSuccess(
        mail.sent
          ? `${input.sheetTitle} synced. ${created.length} ${created.length === 1 ? 'debt' : 'debts'} created and ${mail.count} ${mail.count === 1 ? 'person was' : 'people were'} emailed.`
          : `${input.sheetTitle} synced. ${created.length} ${created.length === 1 ? 'debt was' : 'debts were'} created. ${mail.message}`,
      )
      await loadDebts()
      setIsSheetSyncOpen(false)
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
  }, [debts, isAdmin, user, users])

  const selectedPerson = people.find(
    (person) =>
      person.email.trim().toLowerCase() === personEmail.trim().toLowerCase(),
  )

  const pagedDebts = debts

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
            <div className="flex flex-col gap-2 min-[420px]:flex-row">
              {activeGroup?.sheetSyncEnabled ? (
                <button
                  type="button"
                  onClick={() => setIsSheetSyncOpen(true)}
                  className="btn-secondary"
                >
                  Sync with sheet
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setEditingDebt(undefined)
                  setIsModalOpen(true)
                }}
                className="btn-secondary"
              >
                Add debt
              </button>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(true)}
                className="btn-primary"
              >
                Add expense
              </button>
            </div>
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
                    if (!activeGroup || !selectedPersonId) return
                    const markCopied = () => {
                      setShareText('')
                      setCopied(true)
                      window.setTimeout(() => setCopied(false), 2000)
                    }
                    const revealText = (text: string) => {
                      setCopied(false)
                      setShareText(text)
                    }

                    void createDebtShareToken(activeGroup.id, selectedPersonId)
                      .then(({ token }) => {
                        const url = `${window.location.origin}/share/${token}`
                        const text = buildDebtShareText({
                          debts,
                          email: selectedPerson.email,
                          name: selectedPerson.name,
                          url,
                        })
                        return copyTextToClipboard(text).then((didCopy) => {
                          if (didCopy) markCopied()
                          else revealText(text)
                        })
                      })
                      .catch((err) =>
                        setError(
                          err instanceof Error
                            ? err.message
                            : 'Could not create share link',
                        ),
                      )
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
                        className="h-full min-w-0"
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
                          onRequestClose={setDebtToRequest}
                          onMarkClosed={setDebtToClose}
                          onReopen={setDebtToReopen}
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
                  ...pagination,
                }}
                onPageChange={setPage}
              />
            </div>
          ) : null}
        </section>
      </main>

      <ConfirmModal
        isOpen={Boolean(debtToRequest)}
        title="Confirm that you paid?"
        message={
          debtToRequest
            ? `Confirm that you paid ${formatRupee(debtToRequest.amount)} to ${debtToRequest.creditorName}. They will be emailed and must confirm before this debt is closed.`
            : ''
        }
        confirmLabel="Yes, I paid"
        pendingLabel="Sending request…"
        tone="primary"
        isConfirming={actionLoading}
        onCancel={() => {
          if (!actionLoading) setDebtToRequest(null)
        }}
        onConfirm={() => {
          if (!debtToRequest || !user) return
          const debt = debtToRequest
          aimCardAtTab(debt.id, 'requested')
          void (async () => {
            let mailWarning = ''
            const didSave = await runAction(async () => {
              const updated = await requestDebtClose(activeGroup!.id, debt.id)
              const mail = await notifyDebtMail('payment_requested', updated)
              if (!mail.sent) mailWarning = mail.message
            }, 'Paid request sent. They were emailed to confirm.')
            if (!didSave) {
              setLeaveTarget((current) => {
                const nextTargets = { ...current }
                delete nextTargets[debt.id]
                return nextTargets
              })
              return
            }
            setDebtToRequest(null)
            if (mailWarning) {
              setSuccess('')
              setError(`Paid request saved. ${mailWarning}`)
            }
          })()
        }}
      />

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
                activeGroup!.id,
                debt.id,
                DEBT_STATUS.CLOSED,
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
        isOpen={Boolean(debtToReopen)}
        title={
          debtToReopen?.status === DEBT_STATUS.CLOSE_REQUESTED
            ? 'Move this debt back to open?'
            : 'Reopen this debt?'
        }
        message={
          debtToReopen
            ? `${debtToReopen.status === DEBT_STATUS.CLOSE_REQUESTED ? 'Cancel the close request and move' : 'Move'} the ${formatRupee(debtToReopen.amount)} debt between ${debtToReopen.debtorName} and ${debtToReopen.creditorName} back to Open?`
            : ''
        }
        confirmLabel={
          debtToReopen?.status === DEBT_STATUS.CLOSE_REQUESTED
            ? 'Move to open'
            : 'Reopen debt'
        }
        pendingLabel="Moving…"
        tone="primary"
        isConfirming={actionLoading}
        onCancel={() => {
          if (!actionLoading) setDebtToReopen(null)
        }}
        onConfirm={() => {
          if (!debtToReopen || !user) return
          const debt = debtToReopen
          aimCardAtTab(debt.id, 'open')
          void runAction(
            () => setDebtStatus(activeGroup!.id, debt.id, DEBT_STATUS.OPEN),
            'Moved back to open.',
          ).then((didMove) => {
            if (didMove) {
              setDebtToReopen(null)
              return
            }
            setLeaveTarget((current) => {
              const nextTargets = { ...current }
              delete nextTargets[debt.id]
              return nextTargets
            })
          })
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
          void runAction(
            () => deleteDebt(activeGroup!.id, debt.id),
            'Debt deleted.',
          ).then((didDelete) => {
            if (didDelete) setDebtToDelete(null)
          })
        }}
      />

      {isAdmin ? (
        <>
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
          {isExpenseModalOpen ? (
            <ExpenseFormModal
              isOpen
              users={users}
              isSubmitting={isSubmitting}
              onClose={() => setIsExpenseModalOpen(false)}
              onSubmit={handleCreateExpense}
            />
          ) : null}
          {isSheetSyncOpen && user ? (
            <SheetSyncModal
              isOpen
              groupId={activeGroup!.id}
              users={users}
              isSubmitting={isSubmitting}
              onClose={() => setIsSheetSyncOpen(false)}
              onAddPerson={() => {
                setIsSheetSyncOpen(false)
                navigate('/master')
              }}
              onSubmit={handleSheetSync}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export default DebtOverview
