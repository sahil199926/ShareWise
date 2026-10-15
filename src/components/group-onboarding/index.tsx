import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/use-auth'
import { createGroup, type NewGroupMember } from '../../services/groups.service'
import Logo from '../logo'

const blankMember = (): NewGroupMember => ({ name: '', email: '' })

const GroupOnboarding = () => {
  const {
    activeGroup,
    groups,
    isAuthenticated,
    refreshContext,
    selectGroup,
    logout,
  } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isCreatingAnother = searchParams.get('create') === '1'
  const [name, setName] = useState('')
  const [memberLimit, setMemberLimit] = useState(12)
  const [members, setMembers] = useState<NewGroupMember[]>([blankMember()])
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (activeGroup && !isCreatingAnother)
    return <Navigate to="/dashboard" replace />

  const updateMember = (
    index: number,
    field: keyof NewGroupMember,
    value: string,
  ) => {
    setMembers((current) =>
      current.map((member, itemIndex) =>
        itemIndex === index ? { ...member, [field]: value } : member,
      ),
    )
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setIsSaving(true)
    try {
      const groupId = await createGroup(
        name,
        members.filter((member) => member.email.trim()),
        memberLimit,
      )
      await refreshContext()
      selectGroup(groupId)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create group')
    } finally {
      setIsSaving(false)
    }
  }

  const usedMemberCount = members.filter((item) => item.email.trim()).length + 1

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <main className="glass-card w-full max-w-2xl p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <Logo size="md" />
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void logout()}
          >
            Log out
          </button>
        </div>
        <p className="section-label mt-8">Create your community</p>
        <h1 className="mt-2 text-2xl font-semibold text-high sm:text-3xl">
          {isCreatingAnother
            ? 'Create another group'
            : 'You’re not part of a group yet'}
        </h1>
        <p className="mt-2 text-sm text-low">
          A group supports 12 people by default. Invitations activate only when
          the same verified Google email signs in. You can belong to up to 10
          groups.
        </p>
        <form className="mt-6 space-y-5" onSubmit={submit}>
          {error ? <p className="alert-error">{error}</p> : null}
          <div>
            <label className="field-label" htmlFor="group-name">
              Group name
            </label>
            <input
              id="group-name"
              className="input-field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={80}
              placeholder="Weekend crew"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="member-limit">
              Maximum members
            </label>
            <input
              id="member-limit"
              className="input-field"
              type="number"
              min={2}
              max={10000}
              value={memberLimit}
              onChange={(event) =>
                setMemberLimit(Math.max(2, Number(event.target.value) || 2))
              }
              required
            />
            <p className="mt-1 text-xs text-low">
              Includes you. The default is 12 and can vary by group.
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <label className="field-label">Invite people</label>
              <span className="text-xs text-low">
                {usedMemberCount}/{memberLimit} members
              </span>
            </div>
            <div className="mt-2 space-y-3">
              {members.map((member, index) => (
                <div
                  key={index}
                  className="grid gap-2 sm:grid-cols-[0.8fr_1.2fr_auto]"
                >
                  <input
                    className="input-field mt-0"
                    value={member.name}
                    onChange={(event) =>
                      updateMember(index, 'name', event.target.value)
                    }
                    placeholder="Name"
                    aria-label={`Member ${index + 1} name`}
                  />
                  <input
                    className="input-field mt-0"
                    type="email"
                    value={member.email}
                    onChange={(event) =>
                      updateMember(index, 'email', event.target.value)
                    }
                    placeholder="Google account email"
                    aria-label={`Member ${index + 1} email`}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() =>
                      setMembers((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    disabled={members.length === 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            {members.length < memberLimit - 1 ? (
              <button
                type="button"
                className="btn-secondary mt-3"
                onClick={() =>
                  setMembers((current) => [...current, blankMember()])
                }
              >
                Add another
              </button>
            ) : null}
          </div>
          <div className="rounded-2xl bg-emerald/8 px-4 py-3 text-sm text-medium">
            Need a custom high-capacity group? Contact{' '}
            <a className="link-accent" href="mailto:contact@eonlint.com">
              contact@eonlint.com
            </a>
            .
          </div>
          {isCreatingAnother ? (
            <button
              type="button"
              className="btn-ghost w-full"
              onClick={() => navigate(-1)}
              disabled={isSaving}
            >
              Cancel
            </button>
          ) : null}
          <button
            className="btn-primary w-full"
            disabled={isSaving || groups.length >= 10}
          >
            {isSaving ? 'Creating group…' : 'Create group'}
          </button>
          {groups.length >= 10 ? (
            <p className="alert-error">
              You already belong to 10 groups. Leave or delete one first.
            </p>
          ) : null}
        </form>
      </main>
    </div>
  )
}

export default GroupOnboarding
