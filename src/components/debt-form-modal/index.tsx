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
  debtorEmail: '',
  creditorEmail: '',
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

    setError('')
    setForm(
      debt
        ? {
            debtorEmail: debt.debtorEmail,
            creditorEmail: debt.creditorEmail,
            amount: String(debt.amount),
            note: debt.note,
          }
        : emptyForm,
    )
  }, [debt, isOpen])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const debtor = users.find(
      (user) => user.email.toLowerCase() === form.debtorEmail.toLowerCase(),
    )
    const creditor = users.find(
      (user) => user.email.toLowerCase() === form.creditorEmail.toLowerCase(),
    )
    const amount = Number(form.amount)

    if (!debtor || !creditor) {
      setError('Pick both people from the list.')
      return
    }

    if (debtor.email.toLowerCase() === creditor.email.toLowerCase()) {
      setError('Debtor and receiver must be different people.')
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid amount greater than 0.')
      return
    }

    try {
      await onSubmit({
        debtorEmail: debtor.email,
        debtorName: debtor.name,
        creditorEmail: creditor.email,
        creditorName: creditor.name,
        amount,
        note: form.note.trim(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save debt')
    }
  }

  return (
    <Modal isOpen={isOpen} panelClassName="max-w-lg">
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
            value={form.debtorEmail}
            placeholder="Select person"
            required
            disabled={isSubmitting}
            options={users.map((user) => ({
              value: user.email,
              label: user.name,
            }))}
            onChange={(debtorEmail) =>
              setForm((current) => ({ ...current, debtorEmail }))
            }
          />
        </div>

        <div>
          <label htmlFor="creditor" className="field-label">
            Will receive
          </label>
          <SelectField
            id="creditor"
            value={form.creditorEmail}
            placeholder="Select person"
            required
            disabled={isSubmitting}
            options={users.map((user) => ({
              value: user.email,
              label: user.name,
            }))}
            onChange={(creditorEmail) =>
              setForm((current) => ({ ...current, creditorEmail }))
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
