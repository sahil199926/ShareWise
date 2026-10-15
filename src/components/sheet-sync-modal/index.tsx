import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatRupee } from '../../lib/debt-utils'
import { buildSheetDebts, initialSheetMappings } from '../../lib/sheet-sync'
import {
  listExpenseSheets,
  listSheetAliases,
  listSheetImports,
  previewExpenseSheet,
} from '../../services/sheet-sync.service'
import type { User } from '../../types/auth'
import type { ExpenseDebtProposal } from '../../types/expense'
import type {
  SheetImportReceipt,
  SheetListResult,
  SheetSyncPreview,
  SheetSyncSubmission,
} from '../../types/sheet-sync'
import type { MasterUserOption } from '../../types/user-option'
import Modal from '../modal'
import Pagination from '../pagination'

type SheetSyncModalProps = {
  isOpen: boolean
  user: User
  users: MasterUserOption[]
  isSubmitting: boolean
  onClose: () => void
  onAddPerson: () => void
  onSubmit: (input: SheetSyncSubmission) => Promise<void>
}

const STEPS = ['Choose sheet', 'Match people', 'Review'] as const

const localDate = () => {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

const SheetSyncModal = ({
  isOpen,
  user,
  users,
  isSubmitting,
  onClose,
  onAddPerson,
  onSubmit,
}: SheetSyncModalProps) => {
  const [step, setStep] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [list, setList] = useState<SheetListResult | null>(null)
  const [imports, setImports] = useState<SheetImportReceipt[]>([])
  const [preview, setPreview] = useState<SheetSyncPreview | null>(null)
  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [debts, setDebts] = useState<ExpenseDebtProposal[]>([])
  const [note, setNote] = useState('')
  const [expenseDate, setExpenseDate] = useState(localDate)
  const [isLoading, setIsLoading] = useState(true)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [error, setError] = useState('')

  const importedBySheet = useMemo(
    () => new Map(imports.map((item) => [item.sheetId, item])),
    [imports],
  )

  const loadSheets = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const [nextList, nextImports] = await Promise.all([
        listExpenseSheets(user.email, page, search),
        listSheetImports(user.email),
      ])
      setList(nextList)
      setImports(nextImports)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load sheets.')
    } finally {
      setIsLoading(false)
    }
  }, [page, search, user.email])

  useEffect(() => {
    if (!isOpen || step !== 0) return
    const timer = window.setTimeout(() => void loadSheets(), 250)
    return () => window.clearTimeout(timer)
  }, [isOpen, loadSheets, step])

  const selectSheet = async (sheetId: string) => {
    if (importedBySheet.has(sheetId)) return
    setIsPreviewing(true)
    setError('')
    try {
      const nextPreview = await previewExpenseSheet(user.email, sheetId)
      const aliases = await listSheetAliases(
        user.email,
        nextPreview.spreadsheetId,
      )
      setPreview(nextPreview)
      setMappings(initialSheetMappings(nextPreview.people, users, aliases))
      setNote(nextPreview.sheetTitle)
      setDebts([])
      setStep(1)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not inspect this sheet.',
      )
    } finally {
      setIsPreviewing(false)
    }
  }

  const activePeople = preview?.people.filter(
    (person) => Math.round(person.pending * 100) !== 0,
  )
  const unmatched =
    activePeople?.filter((person) => !mappings[person.rawName]) ?? []
  const blockingIssues =
    preview?.issues.filter((issue) => issue.severity === 'error') ?? []
  const warnings =
    preview?.issues.filter((issue) => issue.severity === 'warning') ?? []

  const showReview = () => {
    if (!preview || blockingIssues.length) return
    if (unmatched.length) {
      setError('Match every person with a non-zero balance first.')
      return
    }
    try {
      const nextDebts = buildSheetDebts(preview, mappings, users)
      if (!nextDebts.length) {
        setError('This sheet is already settled, so there are no debts to add.')
        return
      }
      setDebts(nextDebts)
      setError('')
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build debts.')
    }
  }

  const submit = async () => {
    if (!preview || !debts.length) return
    if (!note.trim()) {
      setError('Add a note for the imported debts.')
      return
    }
    if (!expenseDate) {
      setError('Choose a date for the imported debts.')
      return
    }

    setError('')
    try {
      await onSubmit({
        spreadsheetId: preview.spreadsheetId,
        sheetId: preview.sheetId,
        sheetTitle: preview.sheetTitle,
        fingerprint: preview.fingerprint,
        note: note.trim(),
        expenseDate,
        debts,
        aliases: preview.people.flatMap((person) => {
          const userId = mappings[person.rawName]
          return userId ? [{ alias: person.rawName, userId }] : []
        }),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create debts.')
    }
  }

  const close = () => {
    if (!isSubmitting && !isPreviewing) onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      variant="responsive-sheet"
      overlayClassName="expense-sheet-overlay"
      panelClassName="expense-sheet sheet-sync-panel"
    >
      <div className="expense-sheet-shell">
        <div className="expense-drawer-handle" aria-hidden="true" />
        <div className="expense-sheet-header">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="section-label">Google Sheets</p>
              <h2 className="expense-sheet-title">Sync with sheet</h2>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={isSubmitting || isPreviewing}
              aria-label="Close sheet sync"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-low transition hover:bg-emerald/10 hover:text-high sm:size-10"
            >
              ×
            </button>
          </div>
          <ol
            className="mt-3 grid grid-cols-3 gap-1.5 sm:mt-5 sm:gap-2"
            aria-label="Sheet sync steps"
          >
            {STEPS.map((label, index) => (
              <li key={label} className="min-w-0">
                <div
                  className={`h-1 rounded-full sm:h-1.5 ${index <= step ? 'bg-brand' : 'bg-emerald/10'}`}
                />
                <span
                  className={`mt-1.5 block truncate text-[0.6875rem] leading-4 sm:text-xs ${index === step ? 'font-semibold text-high' : 'text-low'}`}
                >
                  {label}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="expense-sheet-body">
          {error ? <div className="alert-error mb-5">{error}</div> : null}

          {step === 0 ? (
            <div>
              <h3 className="expense-section-title">Choose an expense tab</h3>
              <p className="expense-helper">
                We read only the tab you choose. Nothing is created until the
                final review.
              </p>
              <label htmlFor="sheet-search" className="field-label mt-5">
                Search sheets
              </label>
              <input
                id="sheet-search"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                className="input-field"
                placeholder="Pool party, Manali, movie night..."
                autoFocus
              />

              {isLoading ? (
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="skeleton h-20" />
                  ))}
                </div>
              ) : list?.sheets.length ? (
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {list.sheets.map((sheet) => {
                    const receipt = importedBySheet.get(sheet.sheetId)
                    return (
                      <button
                        key={sheet.sheetId}
                        type="button"
                        disabled={Boolean(receipt) || isPreviewing}
                        onClick={() => void selectSheet(sheet.sheetId)}
                        className="group rounded-2xl border border-divider bg-white/65 p-4 text-left transition hover:border-emerald/35 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-high">
                              {sheet.title}
                            </span>
                            <span className="mt-1 block text-xs text-low">
                              {sheet.rowCount} rows · {sheet.columnCount}{' '}
                              columns
                            </span>
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-[0.6875rem] font-semibold ${receipt ? 'bg-slate-100 text-slate-500' : 'bg-emerald/10 text-emerald-deep'}`}
                          >
                            {receipt ? 'Synced' : 'Select'}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-divider px-5 py-10 text-center">
                  <p className="text-sm font-medium text-high">
                    No matching sheets
                  </p>
                  <p className="mt-1 text-xs text-low">Try a shorter search.</p>
                </div>
              )}

              {list && list.pagination.totalPages > 1 ? (
                <div className="mt-5">
                  <Pagination
                    pagination={list.pagination}
                    onPageChange={setPage}
                    isLoading={isLoading || isPreviewing}
                    itemLabel="sheets"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 1 && preview ? (
            <div>
              <div className="rounded-2xl bg-emerald/8 p-4">
                <p className="section-label">Selected sheet</p>
                <h3 className="mt-1 truncate text-lg font-semibold text-high">
                  {preview.sheetTitle}
                </h3>
                <p className="mt-1 text-sm text-low">
                  {formatRupee(preview.totals.total)} total ·{' '}
                  {activePeople?.length ?? 0} people with a balance
                </p>
              </div>

              {preview.issues.length ? (
                <div className="mt-4 space-y-2">
                  {preview.issues.map((issue, index) => (
                    <div
                      key={`${issue.code}-${index}`}
                      className={
                        issue.severity === 'error'
                          ? 'alert-error'
                          : 'rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'
                      }
                    >
                      {issue.message}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                  <h3 className="expense-section-title">Match people</h3>
                  <p className="expense-helper">
                    Names and emails are auto-matched when the result is unique.
                    Confirm each match before continuing.
                  </p>
                </div>
                {unmatched.length ? (
                  <button
                    type="button"
                    onClick={onAddPerson}
                    className="btn-secondary shrink-0"
                  >
                    Add person
                  </button>
                ) : null}
              </div>

              <div className="mt-4 divide-y divide-divider overflow-hidden rounded-2xl border border-divider bg-white/55">
                {preview.people.map((person) => {
                  const active = Math.round(person.pending * 100) !== 0
                  return (
                    <div
                      key={person.rawName}
                      className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(13rem,0.9fr)] sm:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-high">
                            {person.rawName}
                          </p>
                          {person.requiresReview ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.6875rem] font-semibold text-amber-800">
                              Check combined name
                            </span>
                          ) : null}
                        </div>
                        <p
                          className={`mt-1 text-xs font-medium ${person.pending > 0 ? 'text-danger' : person.pending < 0 ? 'text-success' : 'text-low'}`}
                        >
                          {person.pending > 0
                            ? `Owes ${formatRupee(person.pending)}`
                            : person.pending < 0
                              ? `Receives ${formatRupee(Math.abs(person.pending))}`
                              : 'Settled'}
                        </p>
                      </div>
                      <select
                        aria-label={`Match ${person.rawName}`}
                        disabled={!active || blockingIssues.length > 0}
                        value={mappings[person.rawName] ?? ''}
                        onChange={(event) => {
                          setMappings((current) => ({
                            ...current,
                            [person.rawName]: event.target.value,
                          }))
                          setError('')
                        }}
                        className="input-field mt-0 min-h-11 text-sm"
                      >
                        <option value="">
                          {active ? 'Select a person' : 'No match needed'}
                        </option>
                        {users.flatMap((option) =>
                          option.id ? (
                            <option key={option.id} value={option.id}>
                              {option.name} · {option.email}
                            </option>
                          ) : (
                            []
                          ),
                        )}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          {step === 2 && preview ? (
            <div>
              <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
                <div>
                  <label htmlFor="sheet-note" className="field-label">
                    Debt note
                  </label>
                  <input
                    id="sheet-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="sheet-date" className="field-label">
                    Date
                  </label>
                  <input
                    id="sheet-date"
                    type="date"
                    value={expenseDate}
                    onChange={(event) => setExpenseDate(event.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              {warnings.length ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {warnings.map((warning) => warning.message).join(' ')}
                </div>
              ) : null}

              <div className="mt-5 rounded-2xl bg-emerald/8 p-4">
                <p className="section-label">Final preview</p>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-high">
                      {preview.sheetTitle}
                    </h3>
                    <p className="mt-1 text-sm text-low">
                      {debts.length} {debts.length === 1 ? 'debt' : 'debts'}{' '}
                      will be created
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-high">
                    {formatRupee(
                      debts.reduce((sum, debt) => sum + debt.amount, 0),
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {debts.map((debt, index) => (
                  <div
                    key={`${debt.debtorId}-${debt.creditorId}-${index}`}
                    className="rounded-2xl border border-emerald/20 bg-white/65 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <p className="min-w-0 text-sm text-medium">
                        <strong className="text-high">{debt.debtorName}</strong>{' '}
                        will give{' '}
                        <strong className="text-high">
                          {debt.creditorName}
                        </strong>
                      </p>
                      <p className="shrink-0 text-base font-bold text-emerald-deep">
                        {formatRupee(debt.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-low">
                After creation, this sheet tab is marked as synced and cannot be
                imported again. Debtors will be notified by email.
              </p>
            </div>
          ) : null}
        </div>

        <div className="expense-sheet-footer">
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <button
              type="button"
              onClick={() => {
                if (step === 0) close()
                else {
                  setError('')
                  setStep((current) => current - 1)
                }
              }}
              disabled={isSubmitting || isPreviewing}
              className="btn-secondary expense-secondary-action"
            >
              {step === 0 ? 'Cancel' : 'Back'}
            </button>
            {step === 1 ? (
              <button
                type="button"
                onClick={showReview}
                disabled={
                  blockingIssues.length > 0 ||
                  unmatched.length > 0 ||
                  isSubmitting
                }
                className="btn-primary expense-primary-action"
              >
                Show debts
              </button>
            ) : null}
            {step === 2 ? (
              <button
                type="button"
                onClick={() => void submit()}
                disabled={isSubmitting || !debts.length}
                className="btn-primary expense-primary-action"
              >
                {isSubmitting ? 'Creating debts...' : 'Create debts'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default SheetSyncModal
