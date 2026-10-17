import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SubscriptionPlanDefinition } from '../../types/subscription'
import {
  cancelPaidPlan,
  chooseFreePlan,
  confirmSubscription,
  listSubscriptionPlans,
  startSubscription,
} from '../../services/subscriptions.service'
import { useAuth } from '../../hooks/use-auth'
import Modal from '../modal'

type RazorpayResponse = {
  razorpay_payment_id: string
  razorpay_subscription_id: string
  razorpay_signature: string
}

type RazorpayCheckout = new (options: {
  key: string
  subscription_id: string
  name: string
  description: string
  prefill: { name: string; email: string }
  handler: (response: RazorpayResponse) => void
  modal: { ondismiss: () => void }
}) => { open: () => void }

declare global {
  interface Window {
    Razorpay?: RazorpayCheckout
  }
}

let checkoutScript: Promise<void> | null = null
const loadCheckout = () => {
  if (window.Razorpay) return Promise.resolve()
  if (!checkoutScript) {
    checkoutScript = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () =>
        reject(new Error('Could not load Razorpay Checkout'))
      document.head.appendChild(script)
    }).catch((error) => {
      checkoutScript = null
      throw error
    })
  }
  return checkoutScript
}

const historyLabel = (months: number) =>
  months >= 12 && months % 12 === 0
    ? `${months / 12} ${months === 12 ? 'year' : 'years'}`
    : `${months} ${months === 1 ? 'month' : 'months'}`

const price = (value: number) => `₹${value.toLocaleString('en-IN')}`
const planRank = { free: 0, basic: 1, advanced: 2, pro: 3 }

const initialBilling = (): 'monthly' | 'yearly' => {
  try {
    const pending = sessionStorage.getItem('karja_pending_subscription')
    return pending && JSON.parse(pending).billing === 'yearly'
      ? 'yearly'
      : 'monthly'
  } catch {
    return 'monthly'
  }
}

type Props = {
  onboarding?: boolean
  onActivated?: () => Promise<void>
}

const PlanChooser = ({ onboarding = false, onActivated }: Props) => {
  const { user, refreshContext } = useAuth()
  const [plans, setPlans] = useState<SubscriptionPlanDefinition[]>([])
  const [billing, setBilling] = useState<'monthly' | 'yearly'>(initialBilling)
  const [confirmFree, setConfirmFree] = useState(false)
  const [pendingChange, setPendingChange] = useState<
    | { kind: 'cancel' }
    | { kind: 'downgrade'; plan: SubscriptionPlanDefinition }
    | null
  >(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const freeTriggerRef = useRef<HTMLButtonElement>(null)
  const compareRef = useRef<HTMLButtonElement>(null)
  const changeTriggerRef = useRef<HTMLButtonElement | null>(null)
  const changeBackRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!pendingChange) return
    const trigger = changeTriggerRef.current
    const frame = window.requestAnimationFrame(() =>
      changeBackRef.current?.focus(),
    )
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !working) {
        setPendingChange(null)
        setError('')
      }
      if (event.key !== 'Tab') return
      const dialog = document.querySelector(
        `[role="dialog"][aria-label="${pendingChange.kind === 'cancel' ? 'Confirm subscription cancellation' : 'Confirm plan downgrade'}"]`,
      )
      const buttons = Array.from(
        dialog?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ??
          [],
      )
      const first = buttons[0]
      const last = buttons.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
      trigger?.focus()
    }
  }, [pendingChange, working])

  useEffect(() => {
    if (!confirmFree) return
    const previousFocus = document.activeElement as HTMLElement | null
    const trigger = freeTriggerRef.current
    const frame = window.requestAnimationFrame(() =>
      compareRef.current?.focus(),
    )
    return () => {
      window.cancelAnimationFrame(frame)
      if (previousFocus?.isConnected) previousFocus.focus()
      else trigger?.focus()
    }
  }, [confirmFree])

  useEffect(() => {
    if (!confirmFree) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !working) {
        setConfirmFree(false)
        setError('')
      }
      if (event.key === 'Tab') {
        const dialog = document.querySelector(
          '[role="dialog"][aria-label="Free has limited access"]',
        )
        const buttons = Array.from(
          dialog?.querySelectorAll<HTMLButtonElement>(
            'button:not([disabled])',
          ) ?? [],
        )
        const first = buttons[0]
        const last = buttons.at(-1)
        if (!first || !last) return
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmFree, working])

  useEffect(() => {
    let cancelled = false
    void listSubscriptionPlans()
      .then((items) => {
        if (!cancelled) setPlans(items)
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(
            reason instanceof Error ? reason.message : 'Could not load plans',
          )
      })
    return () => {
      cancelled = true
    }
  }, [])

  const activate = async () => {
    await refreshContext()
    sessionStorage.removeItem('karja_pending_subscription')
    if (onActivated) await onActivated()
    else
      setNotice(
        'Your new plan is active. The limits shown above will update shortly.',
      )
  }

  const selectFree = async () => {
    setError('')
    setWorking(true)
    try {
      await chooseFreePlan()
      setConfirmFree(false)
      await activate()
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not choose Free',
      )
    } finally {
      setWorking(false)
    }
  }

  const selectPaid = async (plan: SubscriptionPlanDefinition) => {
    if (!user) return
    setError('')
    setNotice('')
    setWorking(true)
    try {
      await loadCheckout()
      const started = await startSubscription(plan.id, billing)
      if (!window.Razorpay) throw new Error('Razorpay Checkout did not load')
      const checkout = new window.Razorpay({
        key: started.keyId,
        subscription_id: started.subscriptionId,
        name: 'Karja Tracker',
        description: `${plan.name} · ${billing} subscription`,
        prefill: { name: user.name, email: user.email },
        modal: { ondismiss: () => setWorking(false) },
        handler: (response) => {
          void confirmSubscription(
            started.subscriptionId,
            response.razorpay_payment_id,
            response.razorpay_signature,
          )
            .then(async (result) => {
              if (result.active) await activate()
              else
                setNotice(
                  result.message ||
                    'Your payment is being confirmed. Refresh in a moment.',
                )
            })
            .catch((reason: unknown) => {
              setError(
                reason instanceof Error
                  ? reason.message
                  : 'Could not confirm payment',
              )
            })
            .finally(() => setWorking(false))
        },
      })
      checkout.open()
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not start payment',
      )
      setWorking(false)
    }
  }

  const requestPaidPlan = (
    plan: SubscriptionPlanDefinition,
    trigger: HTMLButtonElement,
  ) => {
    const oldPlan = user?.subscription.storedPlan || 'free'
    if (planRank[plan.id] < planRank[oldPlan]) {
      setError('')
      changeTriggerRef.current = trigger
      setPendingChange({ kind: 'downgrade', plan })
    } else {
      void selectPaid(plan)
    }
  }

  const cancelPaid = async () => {
    setError('')
    setNotice('')
    setWorking(true)
    try {
      const result = await cancelPaidPlan()
      setPendingChange(null)
      setNotice(
        `Your paid plan has been cancelled and Free is active. ${result.deletedDebts.toLocaleString('en-IN')} older shared debt ${result.deletedDebts === 1 ? 'record was' : 'records were'} permanently deleted.`,
      )
      await refreshContext()
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not cancel plan',
      )
    } finally {
      setWorking(false)
    }
  }

  const free = plans.find((plan) => plan.id === 'free')
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-high">Choose your plan</h2>
          <p className="mt-1 text-sm text-low">
            Prices and limits come from the live plan catalogue.
          </p>
        </div>
        <div
          className="flex gap-1 rounded-full bg-white/70 p-1"
          role="group"
          aria-label="Billing interval"
        >
          {(['monthly', 'yearly'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setBilling(option)}
              aria-pressed={billing === option}
              className={
                billing === option
                  ? 'filter-chip-active px-4 py-2'
                  : 'filter-chip px-4 py-2'
              }
            >
              {option === 'monthly' ? 'Monthly' : 'Yearly'}
            </button>
          ))}
        </div>
      </div>
      {error && !confirmFree ? (
        <p className="alert-error mt-4">{error}</p>
      ) : null}
      {notice ? (
        <div className="mt-4 rounded-2xl bg-emerald/10 p-4 text-sm text-emerald-deep">
          {notice}{' '}
          <button
            type="button"
            className="link-accent ml-2"
            onClick={() => void refreshContext()}
          >
            Refresh status
          </button>
        </div>
      ) : null}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {plans.map((plan) => {
          const featured = plan.id === 'advanced'
          const active =
            user?.subscription.plan === plan.id &&
            !user.subscription.accessBlocked
          const currentPaid =
            plan.id !== 'free' &&
            user?.subscription.storedPlan === plan.id &&
            Boolean(user.subscription.subscriptionId)
          const sameBilling = user?.subscription.billingInterval === billing
          const amount =
            billing === 'monthly' ? plan.monthlyPriceInr : plan.yearlyPriceInr
          return (
            <article
              key={plan.id}
              className={`plan-option-card flex flex-col rounded-2xl border p-5 ${
                featured
                  ? 'plan-option-featured border-emerald/60 bg-white'
                  : 'border-divider bg-white/70'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-high">{plan.name}</h3>
                <div className="flex flex-wrap justify-end gap-2">
                  {featured ? (
                    <span className="plan-popular-badge inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold">
                      <span aria-hidden="true">✦</span> Most popular
                    </span>
                  ) : null}
                  {active ? (
                    <span className="rounded-full bg-emerald/10 px-2 py-1 text-xs text-emerald-deep">
                      Current
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-2xl font-semibold text-high">
                {price(amount)}
                <span className="text-sm font-normal text-low">
                  {' '}
                  / {billing === 'monthly' ? 'month' : 'year'}
                </span>
              </p>
              <ul className="mt-4 flex-1 space-y-1 text-sm text-medium">
                <li>
                  {plan.maxCreatedGroups} groups created ·{' '}
                  {plan.maxJoinedGroups} joined
                </li>
                <li>{plan.maxMembersPerGroup} people per group</li>
                <li>{historyLabel(plan.historyMonths)} of history</li>
                <li>
                  {plan.monthlyDebtLimit.toLocaleString('en-IN')} new debts per
                  month
                </li>
              </ul>
              {plan.id === 'free' ? (
                onboarding ? (
                  <button
                    ref={freeTriggerRef}
                    type="button"
                    className="btn-secondary mt-5 w-full"
                    disabled={working}
                    onClick={() => {
                      setError('')
                      setConfirmFree(true)
                    }}
                  >
                    Continue with Free
                  </button>
                ) : (
                  <p className="mt-5 text-sm text-low">
                    Free plan limits shown for comparison.
                  </p>
                )
              ) : (
                <button
                  type="button"
                  className={`btn-primary mt-5 w-full ${featured ? 'plan-featured-action' : ''}`}
                  disabled={working || (active && sameBilling)}
                  onClick={(event) =>
                    requestPaidPlan(plan, event.currentTarget)
                  }
                >
                  {active && sameBilling
                    ? 'Current plan'
                    : working
                      ? 'Please wait…'
                      : active
                        ? 'Change billing'
                        : `Choose ${plan.name}`}
                </button>
              )}
              {currentPaid && !onboarding ? (
                <button
                  type="button"
                  className="mt-3 text-sm font-medium text-red-700 underline underline-offset-4 hover:text-red-900 disabled:opacity-50"
                  disabled={working}
                  onClick={(event) => {
                    setError('')
                    changeTriggerRef.current = event.currentTarget
                    setPendingChange({ kind: 'cancel' })
                  }}
                >
                  Cancel subscription
                </button>
              ) : null}
            </article>
          )
        })}
      </div>
      <p className="mt-4 text-xs leading-5 text-low">
        Paid plans renew automatically. Changing a paid plan charges its full
        price now and starts the new period immediately; unused time on the old
        plan is not credited.
      </p>
      {free
        ? createPortal(
            <Modal
              isOpen={confirmFree}
              variant="dialog"
              ariaLabel="Free has limited access"
              panelClassName="max-w-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-xl font-bold text-amber-800"
                  aria-hidden="true"
                >
                  !
                </span>
                <button
                  type="button"
                  className="rounded-full px-2 text-2xl text-low transition hover:bg-emerald/10 hover:text-high"
                  aria-label="Close warning"
                  disabled={working}
                  onClick={() => {
                    setConfirmFree(false)
                    setError('')
                  }}
                >
                  ×
                </button>
              </div>
              <h3 className="mt-4 text-xl font-semibold text-high">
                Free has limited access
              </h3>
              <p className="mt-2 text-sm leading-6 text-medium">
                You can create {free.maxCreatedGroups} group, join{' '}
                {free.maxJoinedGroups}, include {free.maxMembersPerGroup} people
                per group, see {historyLabel(free.historyMonths)} of history,
                and add {free.monthlyDebtLimit} debts each month.
              </p>
              {error ? (
                <p className="alert-error mt-4" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  ref={compareRef}
                  type="button"
                  className="btn-secondary px-5 py-2.5"
                  disabled={working}
                  onClick={() => {
                    setConfirmFree(false)
                    setError('')
                  }}
                >
                  Compare plans
                </button>
                <button
                  type="button"
                  className="btn-primary px-5 py-2.5"
                  disabled={working}
                  onClick={() => void selectFree()}
                >
                  {working ? 'Please wait…' : 'I understand, use Free'}
                </button>
              </div>
            </Modal>,
            document.body,
          )
        : null}
      {pendingChange
        ? createPortal(
            <Modal
              isOpen
              variant="dialog"
              ariaLabel={
                pendingChange.kind === 'cancel'
                  ? 'Confirm subscription cancellation'
                  : 'Confirm plan downgrade'
              }
              panelClassName="max-w-lg"
            >
              <h3 className="text-xl font-semibold text-high">
                {pendingChange.kind === 'cancel'
                  ? 'Cancel and move to Free?'
                  : `Move to ${pendingChange.plan.name}?`}
              </h3>
              <p className="mt-3 text-sm leading-6 text-medium">
                {pendingChange.kind === 'cancel'
                  ? `Your paid access will end immediately. Free allows ${free?.maxCreatedGroups ?? 1} created group, ${free?.maxJoinedGroups ?? 2} joined groups, ${free?.maxMembersPerGroup ?? 3} people per group, ${historyLabel(free?.historyMonths ?? 1)} of history, and ${free?.monthlyDebtLimit ?? 30} new debts per month. Any Razorpay renewal will be cancelled immediately; unused paid time is not credited.`
                  : `Once your new payment succeeds, ${pendingChange.plan.name} limits apply immediately: ${pendingChange.plan.maxCreatedGroups} created groups, ${pendingChange.plan.maxJoinedGroups} joined groups, ${pendingChange.plan.maxMembersPerGroup} people per group, ${historyLabel(pendingChange.plan.historyMonths)} of history, and ${pendingChange.plan.monthlyDebtLimit} new debts per month. The full new price is charged now; unused paid time is not credited.`}
              </p>
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                Older shared debts beyond the new history window in groups
                controlled by your plan will be permanently deleted for
                everyone. Remaining debts are kept, but new debt creation may
                freeze where the lower limits are already reached. This cannot
                be undone.
              </p>
              {error ? (
                <p className="alert-error mt-4" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  ref={changeBackRef}
                  type="button"
                  className="btn-secondary px-5 py-2.5"
                  disabled={working}
                  onClick={() => {
                    setPendingChange(null)
                    setError('')
                  }}
                >
                  Keep current plan
                </button>
                <button
                  type="button"
                  className="btn-primary px-5 py-2.5"
                  disabled={working}
                  onClick={() => {
                    if (pendingChange.kind === 'cancel') {
                      void cancelPaid()
                    } else {
                      const nextPlan = pendingChange.plan
                      setPendingChange(null)
                      void selectPaid(nextPlan)
                    }
                  }}
                >
                  {working
                    ? 'Please wait…'
                    : pendingChange.kind === 'cancel'
                      ? 'Cancel subscription now'
                      : 'Continue to payment'}
                </button>
              </div>
            </Modal>,
            document.body,
          )
        : null}
    </div>
  )
}

export default PlanChooser
