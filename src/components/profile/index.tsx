import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppHeader from '../app-header'
import Avatar from '../avatar'
import { ProfileFieldsSkeleton, Skeleton } from '../skeleton'
import { useAuth } from '../../hooks/use-auth'
import { updateProfile } from '../../services/profile.service'
import type { User } from '../../types/auth'
import type { ProfileUpdateInput } from '../../types/profile'
import { subscriptionHistoryLabel } from '../../constants/subscription-plans'
import PlanChooser from '../plan-chooser'

const formatReadOnly = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return String(value)
}

const formatDate = (value: string | null) => {
  if (!value) return 'Not applicable'
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

const titleCase = (value: string) =>
  value
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')

const subscriptionStatusClass = (status: User['subscription']['status']) => {
  if (status === 'active' || status === 'trialing') {
    return 'border-emerald/20 bg-emerald/10 text-emerald-deep'
  }
  if (status === 'past_due') {
    return 'border-amber-200 bg-amber-50 text-amber-800'
  }
  return 'border-red-200 bg-red-50 text-red-700'
}

const SubscriptionLimit = ({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) => (
  <div className="rounded-2xl border border-divider bg-white/65 p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-low">
      {label}
    </p>
    <p className="mt-1 text-xl font-semibold text-high">{value}</p>
    {detail ? <p className="mt-1 text-xs text-low">{detail}</p> : null}
  </div>
)

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
      <div className="min-w-0 text-right">
        <span className="break-all text-base font-semibold text-high">
          {formatReadOnly(value)}
        </span>
        {hint ? <p className="mt-1 text-xs text-low">{hint}</p> : null}
      </div>
    </div>
  )
}

const Profile = () => {
  const { user, groups, selectGroup, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<User | null>(user)
  const [form, setForm] = useState<ProfileUpdateInput>(
    user ? toFormState(user) : { name: '', age: null },
  )
  const [isEditing, setIsEditing] = useState(false)
  const isLoading = false
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (window.location.hash === '#plans') {
      window.requestAnimationFrame(() =>
        document.getElementById('plans')?.scrollIntoView(),
      )
    }
  }, [])

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
      const updated = await updateProfile(user, form)
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
    ? {
        ...profile,
        type: user.type,
        role: user.role,
        avatarUrl: profile.avatarUrl || user.avatarUrl,
      }
    : user
  const subscription = user.subscription
  const createdGroupCount = groups.filter(
    (group) => group.role === 'owner',
  ).length
  const joinedGroupCount = groups.filter(
    (group) => group.role !== 'owner',
  ).length
  const controlsGroup = groups.some(
    (group) => group.role === 'owner' || group.role === 'admin',
  )
  const debtUsagePercent = Math.min(
    100,
    subscription.monthlyDebtLimit > 0
      ? (subscription.monthlyDebtUsed / subscription.monthlyDebtLimit) * 100
      : 0,
  )
  const billingLabel = subscription.billingInterval
    ? `₹${subscription.priceInr.toLocaleString('en-IN')} / ${
        subscription.billingInterval === 'yearly' ? 'year' : 'month'
      }`
    : 'No payment required'
  const periodEndLabel = subscription.cancelAtPeriodEnd
    ? 'Access ends'
    : subscription.accessBlocked
      ? 'Expired on'
      : 'Renews on'

  return (
    <div className="page-shell">
      <AppHeader
        title="My Profile"
        onLogout={handleLogout}
        showNavigation={false}
      />

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

        <section className="card mt-6 overflow-hidden">
          <div className="bg-gradient-to-br from-emerald/12 via-white to-emerald/5 px-6 py-6 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="section-label">Subscription</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold capitalize text-high">
                    {subscription.storedPlan} plan
                  </h2>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${subscriptionStatusClass(subscription.status)}`}
                  >
                    {titleCase(subscription.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm capitalize text-low">
                  {subscription.billingInterval
                    ? `${subscription.billingInterval} billing`
                    : 'Free access'}{' '}
                  · {billingLabel}
                </p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/75 px-5 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-low">
                  {periodEndLabel}
                </p>
                <p className="mt-1 font-semibold text-high">
                  {formatDate(subscription.currentPeriodEnd)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6 px-6 py-6 sm:px-8">
            {subscription.cancelAtPeriodEnd ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                This subscription is scheduled to cancel at the end of the
                current billing period. Your existing data will remain safe.
              </div>
            ) : null}

            <div>
              <p className="section-label">Billing details</p>
              <div className="mt-3 divide-y divide-divider rounded-2xl border border-divider bg-white/55 px-4">
                <ProfileField
                  label="Subscription started"
                  value={formatDate(subscription.startedAt)}
                />
                <ProfileField
                  label="Current period started"
                  value={formatDate(subscription.currentPeriodStart)}
                />
                <ProfileField
                  label={periodEndLabel}
                  value={formatDate(subscription.currentPeriodEnd)}
                />
                <ProfileField
                  label="Billing type"
                  value={
                    subscription.billingInterval
                      ? titleCase(subscription.billingInterval)
                      : 'Free'
                  }
                />
                <ProfileField label="Plan price" value={billingLabel} />
                <ProfileField
                  label="Payment status"
                  value={titleCase(subscription.status)}
                />
                <ProfileField
                  label="Cancels after current period"
                  value={subscription.cancelAtPeriodEnd ? 'Yes' : 'No'}
                />
                <ProfileField
                  label="Cancellation recorded"
                  value={
                    subscription.cancelledAt
                      ? formatDate(subscription.cancelledAt)
                      : 'Not cancelled'
                  }
                />
                <ProfileField
                  label="Subscription ID"
                  value={subscription.subscriptionId || 'Not applicable'}
                  hint="Unique billing record attached to your account"
                />
              </div>
            </div>

            <div>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="section-label">Monthly usage</p>
                  <h3 className="mt-1 text-lg font-semibold text-high">
                    Debt records
                  </h3>
                </div>
                <p className="text-sm font-semibold text-high">
                  {subscription.monthlyDebtUsed.toLocaleString('en-IN')} /{' '}
                  {subscription.monthlyDebtLimit.toLocaleString('en-IN')}
                </p>
              </div>
              <div
                className="mt-3 h-2.5 overflow-hidden rounded-full bg-emerald/10"
                role="progressbar"
                aria-label="Monthly debt usage"
                aria-valuemin={0}
                aria-valuemax={subscription.monthlyDebtLimit}
                aria-valuenow={Math.min(
                  subscription.monthlyDebtUsed,
                  subscription.monthlyDebtLimit,
                )}
              >
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-500"
                  style={{ width: `${debtUsagePercent}%` }}
                />
              </div>
            </div>

            <div>
              <p className="section-label">Plan limits</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <SubscriptionLimit
                  label="Groups created"
                  value={`${createdGroupCount} / ${subscription.maxCreatedGroups}`}
                />
                <SubscriptionLimit
                  label="Groups joined"
                  value={`${joinedGroupCount} / ${subscription.maxJoinedGroups}`}
                />
                <SubscriptionLimit
                  label="People per group"
                  value={subscription.maxMembersPerGroup.toLocaleString(
                    'en-IN',
                  )}
                />
                <SubscriptionLimit
                  label="Expense history"
                  value={subscriptionHistoryLabel(subscription.historyMonths)}
                />
              </div>
            </div>

            <p className="text-xs leading-5 text-low">
              These limits apply to groups you create or control as the active
              subscription admin. A group where you are only a member uses that
              group admin’s subscription. Payment reminders are a fixed system
              rule: no more than two combined reminders per person each day.
            </p>
          </div>
        </section>

        <section className="card mt-6 p-6 sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-label">Joined groups</p>
              <h2 className="mt-2 text-xl font-semibold text-high">
                Your communities
              </h2>
            </div>
            <p className="text-sm text-low">
              {createdGroupCount} created · {joinedGroupCount} joined
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {groups.map((group) => (
              <article
                key={group.id}
                className="rounded-2xl border border-divider bg-surface p-4"
              >
                <h3 className="font-semibold text-high">{group.name}</h3>
                <p className="mt-1 text-sm capitalize text-low">
                  {group.role} · up to {group.memberLimit} members
                </p>
                <button
                  type="button"
                  className="btn-secondary mt-4"
                  onClick={() => {
                    selectGroup(group.id)
                    navigate('/dashboard')
                  }}
                >
                  Open group
                </button>
              </article>
            ))}
          </div>

          {createdGroupCount < subscription.maxCreatedGroups ? (
            <Link
              to="/onboarding?create=1"
              className="btn-primary mt-5 inline-flex"
            >
              Create another group
            </Link>
          ) : null}
        </section>

        <section id="plans" className="card mt-6 scroll-mt-8 p-6 sm:p-8">
          <p className="mb-5 text-sm text-low">
            This plan belongs to your account. A group uses its most recently
            added or promoted admin’s plan for shared limits; if there is no
            admin, it uses the owner’s plan. Your upgrade changes a group’s
            capacity only while you control its plan.
          </p>
          {groups.length > 0 && !controlsGroup ? (
            <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              You can upgrade your own plan now. It will not change the limits
              of groups where you are only a member. Your plan applies if you
              create a group or become the admin who controls one.
            </p>
          ) : null}
          <PlanChooser />
        </section>

        <p className="mt-4 text-center text-xs text-low">
          Your profile is shared across groups; debts remain isolated per group.
        </p>
      </main>
    </div>
  )
}

export default Profile
