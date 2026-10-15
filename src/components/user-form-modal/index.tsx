import { useState } from 'react'
import { DEFAULT_USER_TYPE, USER_TYPES } from '../../constants/user-types'
import type { MasterUser, MasterUserInput } from '../../types/master-user'
import Modal from '../modal'
import SelectField from '../select-field'

type UserFormModalProps = {
  isOpen: boolean
  mode: 'create' | 'edit'
  initialData?: MasterUser
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (data: MasterUserInput) => Promise<void>
}

const emptyForm: MasterUserInput = {
  name: '',
  email: '',
  type: DEFAULT_USER_TYPE,
  age: null,
  score: null,
}

const getDefaultForm = (
  mode: 'create' | 'edit',
  initialData?: MasterUser,
): MasterUserInput => {
  if (mode === 'edit' && initialData) {
    return {
      name: initialData.name,
      email: initialData.email,
      type: initialData.type || DEFAULT_USER_TYPE,
      age: initialData.age,
      score: initialData.score,
    }
  }

  return emptyForm
}

const UserFormModal = ({
  isOpen,
  mode,
  initialData,
  isSubmitting,
  onClose,
  onSubmit,
}: UserFormModalProps) => {
  const [form, setForm] = useState<MasterUserInput>(() =>
    getDefaultForm(mode, initialData),
  )
  const [error, setError] = useState('')

  const handleChange = (field: keyof MasterUserInput, value: string) => {
    setForm((current) => ({
      ...current,
      [field]:
        field === 'age' || field === 'score'
          ? value === ''
            ? null
            : Number(value)
          : value,
    }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    try {
      await onSubmit(form)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save user')
    }
  }

  const handleClose = () => {
    if (isSubmitting) return
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      panelClassName="max-h-[90vh] max-w-lg overflow-y-auto"
      onClose={handleClose}
    >
      <h2 className="text-lg font-semibold text-high">
        {mode === 'create' ? 'Add user' : 'Edit user'}
      </h2>
      <p className="mt-1 text-sm text-low">
        {mode === 'edit'
          ? 'Email cannot be changed. Access is always through their verified Google account.'
          : 'Invite a Google account to this group. They become active after signing in.'}
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {error ? <p className="alert-error">{error}</p> : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label">USERS</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
              disabled={isSubmitting}
              className="input-field"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="field-label">EMAIL</label>
            {mode === 'edit' ? (
              <div className="input-readonly">{form.email}</div>
            ) : (
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
                disabled={isSubmitting}
                className="input-field"
              />
            )}
          </div>

          <div>
            <label htmlFor="user-type" className="field-label">
              TYPE
            </label>
            <SelectField
              id="user-type"
              value={form.type}
              disabled={isSubmitting}
              options={USER_TYPES.map((type) => ({
                value: type,
                label: type,
              }))}
              onChange={(type) => handleChange('type', type)}
            />
          </div>

          <div>
            <label className="field-label">Age</label>
            <input
              type="number"
              value={form.age ?? ''}
              onChange={(e) => handleChange('age', e.target.value)}
              disabled={isSubmitting}
              className="input-field"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="field-label">Score</label>
            <input
              type="number"
              value={form.score ?? ''}
              onChange={(e) => handleChange('score', e.target.value)}
              disabled={isSubmitting}
              className="input-field"
            />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="btn-ghost"
          >
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting
              ? 'Saving...'
              : mode === 'create'
                ? 'Add user'
                : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default UserFormModal
