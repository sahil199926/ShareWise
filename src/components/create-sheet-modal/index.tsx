import { useState } from 'react'
import { listMasterUserOptions } from '../../services/sheets.service'
import type { CreateSheetInput, MasterUserOption } from '../../types/sheet'

type CreateSheetModalProps = {
  isOpen: boolean
  isSubmitting: boolean
  requesterEmail: string
  onClose: () => void
  onSubmit: (input: CreateSheetInput) => Promise<void>
}

type Step = 'name' | 'users' | 'items'

const STEPS: Step[] = ['name', 'users', 'items']

const STEP_LABELS: Record<Step, string> = {
  name: 'Name',
  users: 'Users',
  items: 'Items',
}

const resetForm = () => ({
  name: '',
  selectedUsers: [] as string[],
  items: [''],
})

const CreateSheetModal = ({
  isOpen,
  isSubmitting,
  requesterEmail,
  onClose,
  onSubmit,
}: CreateSheetModalProps) => {
  const [step, setStep] = useState<Step>('name')
  const [name, setName] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [items, setItems] = useState<string[]>([''])
  const [masterUsers, setMasterUsers] = useState<MasterUserOption[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) {
    return null
  }

  const stepIndex = STEPS.indexOf(step)

  const resetAndClose = () => {
    const fresh = resetForm()
    setStep('name')
    setName(fresh.name)
    setSelectedUsers(fresh.selectedUsers)
    setItems(fresh.items)
    setMasterUsers([])
    setError('')
    onClose()
  }

  const loadMasterUsers = async () => {
    if (!requesterEmail || masterUsers.length > 0) return

    setIsLoadingUsers(true)

    try {
      const users = await listMasterUserOptions(requesterEmail)
      setMasterUsers(users)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setIsLoadingUsers(false)
    }
  }

  const handleClose = () => {
    if (isSubmitting) return
    resetAndClose()
  }

  const validateNameStep = () => {
    const trimmed = name.trim()

    if (!trimmed) {
      setError('Sheet name is required')
      return false
    }

    if (trimmed.toUpperCase() === 'MASTER') {
      setError('Cannot use reserved name MASTER')
      return false
    }

    setError('')
    return true
  }

  const validateUsersStep = () => {
    if (selectedUsers.length < 1) {
      setError('Select at least one user from MASTER')
      return false
    }

    setError('')
    return true
  }

  const validateItemsStep = () => {
    const trimmedItems = items.map((item) => item.trim()).filter(Boolean)

    if (trimmedItems.length < 1) {
      setError('Add at least one item')
      return false
    }

    setError('')
    return true
  }

  const handleNext = async () => {
    if (step === 'name' && validateNameStep()) {
      setStep('users')
      await loadMasterUsers()
      return
    }

    if (step === 'users' && validateUsersStep()) {
      setStep('items')
    }
  }

  const handleBack = () => {
    setError('')

    if (step === 'users') {
      setStep('name')
      return
    }

    if (step === 'items') {
      setStep('users')
    }
  }

  const toggleUser = (userName: string) => {
    setSelectedUsers((current) => {
      if (current.includes(userName)) {
        return current.filter((name) => name !== userName)
      }

      return [...current, userName]
    })
  }

  const handleItemChange = (index: number, value: string) => {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    )
  }

  const addItemRow = () => {
    setItems((current) => [...current, ''])
  }

  const removeItemRow = (index: number) => {
    setItems((current) => {
      if (current.length === 1) {
        return ['']
      }

      return current.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!validateItemsStep()) return

    const trimmedItems = items.map((item) => item.trim()).filter(Boolean)

    try {
      await onSubmit({
        name: name.trim(),
        users: selectedUsers,
        items: trimmedItems,
      })

      const fresh = resetForm()
      setStep('name')
      setName(fresh.name)
      setSelectedUsers(fresh.selectedUsers)
      setItems(fresh.items)
      setError('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sheet')
    }
  }

  return (
    <div className="modal-overlay">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-sheet-title"
        className="modal-panel max-h-[90vh] max-w-lg overflow-y-auto"
      >
        <h2 id="create-sheet-title" className="text-lg font-semibold text-high">
          Create new sheet
        </h2>
        <p className="mt-1 text-sm text-low">
          Step {stepIndex + 1} of {STEPS.length}: {STEP_LABELS[step]}
        </p>

        <div className="mt-4 flex gap-2">
          {STEPS.map((stepKey, index) => (
            <div
              key={stepKey}
              className={`h-1.5 flex-1 rounded-full transition ${
                index <= stepIndex ? 'bg-emerald-light' : 'bg-divider'
              }`}
            />
          ))}
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {error ? <p className="alert-error">{error}</p> : null}

          {step === 'name' ? (
            <div>
              <label htmlFor="sheet-name" className="field-label">
                Sheet name
              </label>
              <input
                id="sheet-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. March Expenses"
                disabled={isSubmitting}
                className="input-field"
                autoFocus
              />
              <p className="mt-2 text-xs text-low">
                Name cannot be MASTER or match an existing sheet.
              </p>
            </div>
          ) : null}

          {step === 'users' ? (
            <div>
              <p className="field-label">Select users from MASTER</p>
              {isLoadingUsers ? (
                <div className="mt-3 space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="skeleton h-10" />
                  ))}
                </div>
              ) : masterUsers.length === 0 ? (
                <p className="mt-2 text-sm text-low">
                  No users found in MASTER.
                </p>
              ) : (
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-divider p-3">
                  {masterUsers.map((user) => {
                    const isSelected = selectedUsers.includes(user.name)

                    return (
                      <label
                        key={user.email}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${
                          isSelected
                            ? 'border-emerald-light bg-emerald/10'
                            : 'border-divider hover:bg-surface-elevated'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleUser(user.name)}
                          disabled={isSubmitting}
                          className="h-4 w-4 accent-emerald"
                        />
                        <span className="text-sm font-medium text-high">
                          {user.name}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
              <p className="mt-2 text-xs text-low">
                Selected {selectedUsers.length} user
                {selectedUsers.length === 1 ? '' : 's'}.
              </p>
            </div>
          ) : null}

          {step === 'items' ? (
            <div>
              <p className="field-label">Expense items</p>
              <div className="mt-3 space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(event) =>
                        handleItemChange(index, event.target.value)
                      }
                      placeholder={`Item ${index + 1}`}
                      disabled={isSubmitting}
                      className="input-field"
                    />
                    <button
                      type="button"
                      onClick={() => removeItemRow(index)}
                      disabled={isSubmitting}
                      className="btn-ghost shrink-0 px-3"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addItemRow}
                disabled={isSubmitting}
                className="btn-ghost mt-2"
              >
                + Add item
              </button>
              <p className="mt-2 text-xs text-low">
                Each item starts with 0 under every user. GIVEN and pending rows
                start at 0.
              </p>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="btn-ghost"
            >
              Cancel
            </button>

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              {step !== 'name' ? (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="btn-ghost"
                >
                  Back
                </button>
              ) : null}

              {step !== 'items' ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={
                    isSubmitting || (step === 'users' && isLoadingUsers)
                  }
                  className="btn-primary"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary"
                >
                  {isSubmitting ? 'Creating...' : 'Create sheet'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateSheetModal
