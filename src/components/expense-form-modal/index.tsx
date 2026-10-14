import { useMemo, useState } from 'react'
import {
  calculateExpense,
  fitsMoneyCap,
  moneyToPaise,
} from '../../lib/expense-split'
import { formatRupee } from '../../lib/debt-utils'
import {
  EXPENSE_SPLIT_METHOD,
  type ExpenseCalculation,
  type ExpensePerson,
  type ExpenseSplitMethod,
  type ExpenseSubmission,
} from '../../types/expense'
import type { MasterUserOption } from '../../types/user-option'
import Modal from '../modal'

type ExpenseFormModalProps = {
  isOpen: boolean
  users: MasterUserOption[]
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (input: ExpenseSubmission) => Promise<void>
}

const STEPS = ['Details', 'Paid by', 'Split', 'Review'] as const

const localDate = () => {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

const sumEnteredMoney = (
  people: ExpensePerson[],
  values: Record<string, string>,
) =>
  people.reduce((sum, person) => {
    const value = moneyToPaise(values[person.id]?.trim() || '0')
    return sum + (value ?? 0)
  }, 0) / 100

const AssignmentMeter = ({
  label,
  value,
  percent,
}: {
  label: string
  value: string
  percent: number
}) => (
  <div className="mt-4 rounded-2xl bg-emerald/8 px-4 py-3 text-sm">
    <div className="flex justify-between gap-3">
      <span className="text-medium">{label}</span>
      <strong className="text-high">{value}</strong>
    </div>
    <div
      className="mt-2 h-2 overflow-hidden rounded-full bg-white"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(100, Math.max(0, percent)))}
      aria-label={label}
    >
      <div
        className="h-full rounded-full bg-brand motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  </div>
)

const ExpenseFormModal = ({
  isOpen,
  users,
  isSubmitting,
  onClose,
  onSubmit,
}: ExpenseFormModalProps) => {
  const availablePeople = useMemo(
    () =>
      users.flatMap((user) =>
        user.id ? [{ id: user.id, name: user.name, email: user.email }] : [],
      ),
    [users],
  )
  const [step, setStep] = useState(0)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [expenseDate, setExpenseDate] = useState(localDate)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [paidAmounts, setPaidAmounts] = useState<Record<string, string>>({})
  const [splitMethod, setSplitMethod] = useState<ExpenseSplitMethod>(
    EXPENSE_SPLIT_METHOD.EQUAL,
  )
  const [splitValues, setSplitValues] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<ExpenseCalculation | null>(null)
  const [error, setError] = useState('')

  const people = useMemo(
    () => availablePeople.filter((person) => selectedIds.includes(person.id)),
    [availablePeople, selectedIds],
  )
  const totalAmount = (moneyToPaise(amount) ?? 0) / 100
  const paidTotal = sumEnteredMoney(people, paidAmounts)
  const splitTotal =
    splitMethod === EXPENSE_SPLIT_METHOD.AMOUNT
      ? sumEnteredMoney(people, splitValues)
      : people.reduce(
          (sum, person) => sum + Number(splitValues[person.id] || 0),
          0,
        )

  const togglePerson = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((personId) => personId !== id)
        : [...current, id],
    )
    setPreview(null)
    setError('')
  }

  const validateDetails = () => {
    const paise = moneyToPaise(amount)
    if (paise === null || paise <= 0) {
      setError('Enter an expense amount greater than ₹0.')
      return false
    }
    if (!note.trim()) {
      setError('Add a short description for this expense.')
      return false
    }
    if (!expenseDate) {
      setError('Choose the expense date.')
      return false
    }
    if (people.length < 2) {
      setError('Select at least 2 people involved in this expense.')
      return false
    }
    return true
  }

  const validatePayments = () => {
    for (const person of people) {
      const raw = paidAmounts[person.id]?.trim() || '0'
      if (moneyToPaise(raw) === null) {
        setError(`Payment for ${person.name} must use at most 2 decimals.`)
        return false
      }
    }
    if (Math.round(paidTotal * 100) !== Math.round(totalAmount * 100)) {
      setError(`Payments must add up to ${formatRupee(totalAmount)}.`)
      return false
    }
    return true
  }

  const showPreview = () => {
    try {
      const result = calculateExpense({
        total: amount,
        people,
        paidAmounts,
        splitMethod,
        splitValues,
      })
      setPreview(result)
      setError('')
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check the split values.')
    }
  }

  const goForward = () => {
    setError('')
    if (step === 0) {
      if (!validateDetails()) return
      setStep(1)
      return
    }
    if (step === 1) {
      if (!validatePayments()) return
      setStep(2)
      return
    }
    if (step === 2) showPreview()
  }

  const submit = async () => {
    if (!preview) return
    setError('')
    try {
      await onSubmit({
        ...preview,
        note: note.trim(),
        expenseDate,
        splitMethod,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create expense.')
    }
  }

  const close = () => {
    if (!isSubmitting) onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      variant="responsive-sheet"
      overlayClassName="expense-sheet-overlay"
      panelClassName="expense-sheet"
    >
      <div className="expense-sheet-shell">
        <div className="expense-drawer-handle" aria-hidden="true" />
        <div className="expense-sheet-header">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="section-label">New expense</p>
              <h2 className="expense-sheet-title">Add an expense</h2>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={isSubmitting}
              aria-label="Close expense form"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-low transition hover:bg-emerald/10 hover:text-high sm:size-10"
            >
              ×
            </button>
          </div>
          <ol
            className="mt-3 grid grid-cols-4 gap-1.5 sm:mt-5 sm:gap-2"
            aria-label="Expense steps"
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
            <div className="space-y-5">
              <div>
                <label htmlFor="expense-amount" className="field-label">
                  Total amount
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-4 z-10 -translate-y-1/2 text-lg font-semibold text-low">
                    ₹
                  </span>
                  <input
                    id="expense-amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="input-field pl-9 text-lg font-semibold"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                <div>
                  <label htmlFor="expense-note" className="field-label">
                    What was it for?
                  </label>
                  <input
                    id="expense-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className="input-field"
                    placeholder="Dinner, cab, groceries..."
                  />
                </div>
                <div>
                  <label htmlFor="expense-date" className="field-label">
                    Date
                  </label>
                  <input
                    id="expense-date"
                    type="date"
                    value={expenseDate}
                    onChange={(event) => setExpenseDate(event.target.value)}
                    className="input-field"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="field-label">Who was involved?</p>
                    <p className="mt-1 text-xs text-low">
                      Only these people will appear in payment and split steps.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="link-accent shrink-0"
                    onClick={() => {
                      setSelectedIds(
                        selectedIds.length === availablePeople.length
                          ? []
                          : availablePeople.map((person) => person.id),
                      )
                    }}
                  >
                    {selectedIds.length === availablePeople.length
                      ? 'Clear all'
                      : 'Select all'}
                  </button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {availablePeople.map((person) => {
                    const selected = selectedIds.includes(person.id)
                    return (
                      <label
                        key={person.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition ${selected ? 'border-emerald/35 bg-emerald/10' : 'border-divider bg-white/55 hover:bg-white/80'}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => togglePerson(person.id)}
                          className="size-5 accent-emerald-deep"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-high">
                            {person.name}
                          </span>
                          <span className="block truncate text-xs text-low">
                            {person.email}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div>
              <h3 className="expense-section-title">Who paid?</h3>
              <p className="expense-helper">
                Enter an amount for every payer. Leave ₹0 for everyone else.
              </p>
              <AssignmentMeter
                label="Assigned"
                value={`${formatRupee(paidTotal)} of ${formatRupee(totalAmount)}`}
                percent={
                  totalAmount ? (paidTotal / totalAmount) * 100 : 0
                }
              />
              <div className="mt-4 divide-y divide-divider rounded-2xl border border-divider bg-white/55">
                {people.map((person) => (
                  <div key={person.id} className="expense-person-row">
                    <label
                      htmlFor={`paid-${person.id}`}
                      className="min-w-0 flex-1 truncate text-sm font-medium text-high"
                    >
                      {person.name}
                    </label>
                    <div className="relative w-[7.25rem] shrink-0 min-[380px]:w-36 sm:w-44">
                      <span className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-sm text-low">
                        ₹
                      </span>
                      <input
                        id={`paid-${person.id}`}
                        type="text"
                        inputMode="decimal"
                        value={paidAmounts[person.id] ?? ''}
                        onChange={(event) => {
                          const nextValue = event.target.value
                          if (
                            !fitsMoneyCap(
                              people,
                              paidAmounts,
                              person.id,
                              nextValue,
                              totalAmount,
                            )
                          ) {
                            return
                          }
                          setPaidAmounts((current) => ({
                            ...current,
                            [person.id]: nextValue,
                          }))
                        }}
                        className="input-field mt-0 min-h-11 py-2 pl-7 text-right text-base"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <h3 className="expense-section-title">How should it be split?</h3>
              <div className="mt-4 grid grid-cols-3 rounded-2xl bg-emerald/8 p-1">
                {(
                  [
                    [EXPENSE_SPLIT_METHOD.EQUAL, 'Equally'],
                    [EXPENSE_SPLIT_METHOD.PERCENTAGE, 'By %'],
                    [EXPENSE_SPLIT_METHOD.AMOUNT, 'By amount'],
                  ] as const
                ).map(([method, label]) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      setSplitMethod(method)
                      setError('')
                    }}
                    className={`rounded-xl px-2 py-2.5 text-sm font-semibold transition ${splitMethod === method ? 'bg-white text-high shadow-sm' : 'text-low hover:text-high'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <AssignmentMeter
                label="Split assigned"
                value={
                  splitMethod === EXPENSE_SPLIT_METHOD.EQUAL
                    ? `${formatRupee(totalAmount)} of ${formatRupee(totalAmount)}`
                    : splitMethod === EXPENSE_SPLIT_METHOD.AMOUNT
                      ? `${formatRupee(splitTotal)} of ${formatRupee(totalAmount)}`
                      : `${Number.isFinite(splitTotal) ? splitTotal : 0}% of 100%`
                }
                percent={
                  splitMethod === EXPENSE_SPLIT_METHOD.EQUAL
                    ? 100
                    : splitMethod === EXPENSE_SPLIT_METHOD.AMOUNT
                      ? totalAmount
                        ? (splitTotal / totalAmount) * 100
                        : 0
                      : Number.isFinite(splitTotal)
                        ? splitTotal
                        : 0
                }
              />
              {splitMethod === EXPENSE_SPLIT_METHOD.EQUAL ? (
                <p className="mt-3 text-sm text-medium">
                  {formatRupee(totalAmount)} will be divided between{' '}
                  {people.length} people. Any remaining paise is assigned in
                  list order.
                </p>
              ) : null}

              <div className="mt-4 divide-y divide-divider rounded-2xl border border-divider bg-white/55">
                {people.map((person) => (
                  <div key={person.id} className="expense-person-row">
                    <label
                      htmlFor={`split-${person.id}`}
                      className="min-w-0 flex-1 truncate text-sm font-medium text-high"
                    >
                      {person.name}
                    </label>
                    {splitMethod === EXPENSE_SPLIT_METHOD.EQUAL ? (
                      <span className="text-sm font-semibold text-medium">
                        ≈ {formatRupee(totalAmount / people.length)}
                      </span>
                    ) : (
                      <div className="relative w-[7.25rem] shrink-0 min-[380px]:w-36 sm:w-44">
                        {splitMethod === EXPENSE_SPLIT_METHOD.AMOUNT ? (
                          <span className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-sm text-low">
                            ₹
                          </span>
                        ) : null}
                        <input
                          id={`split-${person.id}`}
                          type="text"
                          inputMode="decimal"
                          value={splitValues[person.id] ?? ''}
                          onChange={(event) => {
                            const nextValue = event.target.value
                            const cap =
                              splitMethod === EXPENSE_SPLIT_METHOD.PERCENTAGE
                                ? 100
                                : totalAmount
                            if (
                              !fitsMoneyCap(
                                people,
                                splitValues,
                                person.id,
                                nextValue,
                                cap,
                              )
                            ) {
                              return
                            }
                            setSplitValues((current) => ({
                              ...current,
                              [person.id]: nextValue,
                            }))
                          }}
                          className={`input-field mt-0 min-h-11 py-2 text-right text-base ${splitMethod === EXPENSE_SPLIT_METHOD.AMOUNT ? 'pr-3 pl-7' : 'pr-8 pl-3'}`}
                          placeholder="0"
                        />
                        {splitMethod === EXPENSE_SPLIT_METHOD.PERCENTAGE ? (
                          <span className="pointer-events-none absolute top-1/2 right-3 z-10 -translate-y-1/2 text-sm text-low">
                            %
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {step === 3 && preview ? (
            <div>
              <div className="rounded-2xl bg-emerald/8 p-4">
                <p className="section-label">Expense summary</p>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-high">{note}</h3>
                    <p className="mt-1 text-sm text-low">
                      {expenseDate} · {people.length} people
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-high">
                    {formatRupee(preview.totalAmount)}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <section>
                  <h3 className="text-sm font-semibold text-high">
                    Paid and share
                  </h3>
                  <div className="mt-2 divide-y divide-divider rounded-2xl border border-divider bg-white/55">
                    {people.map((person) => (
                      <div key={person.id} className="px-4 py-3 text-sm">
                        <p className="font-medium text-high">{person.name}</p>
                        <p className="mt-1 text-xs text-low">
                          Paid {formatRupee(preview.paidAmounts[person.id])} ·
                          Share {formatRupee(preview.owedAmounts[person.id])}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-high">
                    Debts that will be created
                  </h3>
                  {preview.debts.length ? (
                    <div className="mt-2 space-y-2">
                      {preview.debts.map((debt, index) => (
                        <div
                          key={`${debt.debtorId}-${debt.creditorId}-${index}`}
                          className="rounded-2xl border border-emerald/20 bg-emerald/8 px-4 py-3"
                        >
                          <p className="text-sm text-medium">
                            <strong className="text-high">
                              {debt.debtorName}
                            </strong>{' '}
                            will give{' '}
                            <strong className="text-high">
                              {debt.creditorName}
                            </strong>
                          </p>
                          <p className="mt-1 text-lg font-bold text-emerald-deep">
                            {formatRupee(debt.amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 rounded-2xl border border-emerald/20 bg-emerald/8 px-4 py-6 text-center">
                      <p className="font-medium text-high">Already settled</p>
                      <p className="mt-1 text-sm text-low">
                        Everyone paid exactly their share, so no debt is needed.
                      </p>
                    </div>
                  )}
                </section>
              </div>
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
                  setStep((current) => Math.max(0, current - 1))
                }
              }}
              disabled={isSubmitting}
              className="btn-ghost expense-secondary-action"
            >
              {step === 0 ? 'Cancel' : 'Back'}
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={goForward}
                className="btn-primary expense-primary-action"
              >
                {step === 2 ? 'Show me all debts' : 'Continue'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void submit()}
                disabled={isSubmitting || !preview?.debts.length}
                className="btn-primary expense-primary-action"
              >
                {isSubmitting ? 'Creating...' : 'Create expense & notify'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default ExpenseFormModal
