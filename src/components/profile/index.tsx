import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppHeader from '../app-header'
import Avatar from '../avatar'
import { ProfileFieldsSkeleton, Skeleton } from '../skeleton'
import { useAuth } from '../../hooks/use-auth'
import { getProfile, updateProfile } from '../../services/profile.service'
import type { User } from '../../types/auth'
import type { ProfileUpdateInput } from '../../types/profile'

const formatReadOnly = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return String(value)
}

const toFormState = (user: User): ProfileUpdateInput => ({
  name: user.name,
  age: user.age,
})

type ProfileFieldProps = {
  label: string
  value: string | number | null | undefined
  hint?: string
}

const ProfileField = ({ label, value, hint }: ProfileFieldProps) => {
  return (
    <div className="flex flex-col gap-1 border-b border-divider py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="field-label">{label}</span>
      <div className="text-right">
        <span className="text-base font-semibold text-high">
          {formatReadOnly(value)}
        </span>
        {hint ? <p className="mt-1 text-xs text-low">{hint}</p> : null}
      </div>
    </div>
  )
}

const Profile = () => {
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<User | null>(user)
  const [form, setForm] = useState<ProfileUpdateInput>(
    user ? toFormState(user) : { name: '', age: null },
  )
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!user?.email) return

    getProfile(user.email)
      .then((freshProfile) => {
        setProfile(freshProfile)
        setForm(toFormState(freshProfile))
        updateUser(freshProfile)
        setError('')
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load profile')
        setProfile(user)
        setForm(toFormState(user))
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [user, updateUser])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleChange = (field: keyof ProfileUpdateInput, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: field === 'age' ? (value === '' ? null : Number(value)) : value,
    }))
    setSuccess('')
  }

  const handleStartEdit = () => {
    if (!profile) return
    setForm(toFormState(profile))
    setIsEditing(true)
    setError('')
    setSuccess('')
  }

  const handleCancelEdit = () => {
    if (profile) {
      setForm(toFormState(profile))
    }
    setIsEditing(false)
    setError('')
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user?.email) return

    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      const updated = await updateProfile(user.email, form)
      const nextUser = {
        ...updated,
        avatarUrl: updated.avatarUrl || user.avatarUrl,
      }
      setProfile(nextUser)
      setForm(toFormState(nextUser))
      updateUser(nextUser)
      setSuccess('Profile updated successfully')
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  if (!user) {
    return null
  }

  const displayUser = profile
    ? { ...profile, avatarUrl: profile.avatarUrl || user.avatarUrl }
    : user

  return (
    <div className="page-shell">
      <AppHeader title="My Profile" onLogout={handleLogout} />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Link to="/dashboard" className="link-accent">
          ← Back to dashboard
        </Link>

        {error ? <div className="alert-error mt-6">{error}</div> : null}
        {success ? <div className="alert-success mt-6">{success}</div> : null}

        <div className="card mt-6 overflow-hidden">
          <div className="hero-banner px-6 py-8 sm:px-8">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end">
                <Avatar
                  name={displayUser.name}
                  avatarUrl={displayUser.avatarUrl}
                  className="h-20 w-20 border-4 border-white/30 text-2xl shadow-lg"
                />
                <div className="text-center sm:text-left">
                  {isLoading ? (
                    <>
                      <Skeleton className="mx-auto h-7 w-40 bg-white/30 sm:mx-0" />
                      <Skeleton className="mx-auto mt-2 h-4 w-48 bg-white/20 sm:mx-0" />
                    </>
                  ) : (
                    <>
                      <h2 className="hero-banner-title">{displayUser.name}</h2>
                      <p className="hero-banner-subtitle">{user.email}</p>
                    </>
                  )}
                </div>
              </div>

              {!isLoading && !isEditing ? (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="btn-secondary"
                >
                  Edit profile
                </button>
              ) : null}
            </div>
          </div>

          <div className="px-6 py-2 sm:px-8">
            <p className="section-label py-4">Account details</p>

            {isLoading ? (
              <ProfileFieldsSkeleton />
            ) : isEditing ? (
              <form className="space-y-5 pb-6" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="profile-name" className="field-label">
                    Name
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    disabled={isSaving}
                    required
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="field-label">Email</label>
                  <p className="input-readonly">{user.email}</p>
                  <p className="mt-1 text-xs text-low">
                    Email cannot be changed
                  </p>
                </div>

                <div>
                  <label className="field-label">Type</label>
                  <p className="input-readonly">
                    {formatReadOnly(displayUser.type)}
                  </p>
                  <p className="mt-1 text-xs text-low">
                    Type cannot be changed
                  </p>
                </div>

                <div>
                  <label htmlFor="profile-age" className="field-label">
                    Age
                  </label>
                  <input
                    id="profile-age"
                    type="number"
                    value={form.age ?? ''}
                    onChange={(e) => handleChange('age', e.target.value)}
                    disabled={isSaving}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="field-label">Score</label>
                  <p className="input-readonly font-semibold text-high">
                    {formatReadOnly(displayUser.score)}
                  </p>
                  <p className="mt-1 text-xs text-low">
                    Score cannot be changed
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn-primary"
                  >
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="pb-4">
                <ProfileField label="Name" value={displayUser.name} />
                <ProfileField label="Email" value={user.email} />
                <ProfileField label="Type" value={displayUser.type} />
                <ProfileField label="Age" value={displayUser.age} />
                <ProfileField label="Score" value={displayUser.score} />
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-low">
          People and debts both live in Karja Tracker.
        </p>
      </main>
    </div>
  )
}

export default Profile
