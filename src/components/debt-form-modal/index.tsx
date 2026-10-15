import { useEffect, useState } from 'react'
import type { Debt, DebtInput } from '../../types/debt'
import type { MasterUserOption } from '../../types/user-option'
import Modal from '../modal'
import SelectField from '../select-field'

type DebtFormModalProps = {
  isOpen: boolean
  mode: 'create' | 'edit'
  debt?: Debt
  users: MasterUserOption[]
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (input: DebtInput) => Promise<void>
}

const emptyForm = {
  debtorId: '',
  creditorId: '',
  amount: '',
  note: '',
}

const DebtFormModal = ({
  isOpen,
  mode,
  debt,
  users,
  isSubmitting,
  onClose,
  onSubmit,
}: DebtFormModalProps) => {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return

    const timer = window.setTimeout(() => {
      setError('')
      setForm(
        debt
          ? {
              debtorId: debt.debtorId,
              creditorId: debt.creditorId,
              amount: String(debt.amount),
              note: debt.note,
            }
          : emptyForm,
      )
    }, 0)
    return () => window.clearTimeout(timer)
  }, [debt, isOpen])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const debtor = users.find((user) => user.id === form.debtorId)
    const creditor = users.find((user) => user.id === form.creditorId)
    const amount = Number(form.amount)

    if (!debtor?.id || !creditor?.id) {
      setError('Pick both people from the list.')
      return
    }

    if (debtor.id === creditor.id) {
      setError('Debtor and receiver must be different people.')
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid amount greater than 0.')
      return
    }

    try {
      await onSubmit({
        debtorId: debtor.id,
        creditorId: creditor.id,
        amount,
        note: form.note.trim(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save debt')
    }
  }

  return (
    <Modal isOpen={isOpen} panelClassName="max-w-lg" onClose={onClose}>
      <p className="section-label">
        {mode === 'create' ? 'New karja' : 'Edit karja'}
      </p>
      <h2 className="mt-1 text-xl font-semibold text-high">
        {mode === 'create' ? 'Add a debt' : 'Update this debt'}
      </h2>
      <p className="mt-1 text-sm text-low">Who owes whom, how much, and why.</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {error ? <p className="alert-error">{error}</p> : null}

        <div>
          <label htmlFor="debtor" className="field-label">
            Who owes
          </label>
          <SelectField
            id="debtor"
            value={form.debtorId}
            placeholder="Select person"
            required
            disabled={isSubmitting}
            options={users.flatMap((user) =>
              user.id ? [{ value: user.id, label: user.name }] : [],
            )}
            onChange={(debtorId) =>
              setForm((current) => ({ ...current, debtorId }))
            }
          />
        </div>

        <div>
          <label htmlFor="creditor" className="field-label">
            Will receive
          </label>
          <SelectField
            id="creditor"
            value={form.creditorId}
            placeholder="Select person"
            required
            disabled={isSubmitting}
            options={users.flatMap((user) =>
              user.id ? [{ value: user.id, label: user.name }] : [],
            )}
            onChange={(creditorId) =>
              setForm((current) => ({ ...current, creditorId }))
            }
          />
        </div>

        <div>
          <label htmlFor="amount" className="field-label">
            Amount
          </label>
          <input
            id="amount"
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                amount: event.target.value,
              }))
            }
            className="input-field"
            placeholder="0.00"
            required
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="note" className="field-label">
            Note
          </label>
          <textarea
            id="note"
            value={form.note}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                note: event.target.value,
              }))
            }
            className="input-field min-h-24 resize-none"
            placeholder="Burger, movie, shake..."
            disabled={isSubmitting}
          />
        </div>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn-ghost"
          >
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting
              ? 'Saving...'
              : mode === 'create'
                ? 'Add debt'
                : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default DebtFormModal
