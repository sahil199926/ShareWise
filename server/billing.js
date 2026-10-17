import {
  createHmac,
  timingSafeEqual,
  verify,
  X509Certificate,
} from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const razorpayBase = 'https://api.razorpay.com/v1'
const firebaseCertUrl =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
let firebaseCertificates = null
let certificateExpiry = 0

const fail = (status, error) => ({ status, body: { error } })
const isId = (value, prefix) =>
  typeof value === 'string' &&
  new RegExp(`^${prefix}_[A-Za-z0-9]{8,40}$`).test(value)
const safeEqual = (expected, received) => {
  if (typeof received !== 'string' || !/^[a-f0-9]{64}$/i.test(received))
    return false
  const left = Buffer.from(expected, 'hex')
  const right = Buffer.from(received, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}

export const verifyCheckoutSignature = (
  paymentId,
  storedSubscriptionId,
  signature,
  keySecret,
) =>
  safeEqual(
    createHmac('sha256', keySecret)
      .update(`${paymentId}|${storedSubscriptionId}`)
      .digest('hex'),
    signature,
  )

export const verifyWebhookSignature = (rawBody, signature, secret) =>
  safeEqual(
    createHmac('sha256', secret).update(rawBody).digest('hex'),
    signature,
  )

const database = (env) => {
  const url = env.SUPABASE_URL?.trim()
  const key = (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)?.trim()
  if (!url || !key) throw new Error('Billing database is not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

const razorpayCredentials = (env) => {
  const keyId = env.RAZORPAY_KEY_ID?.trim()
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim()
  if (!keyId || !keySecret) throw new Error('Razorpay is not configured')
  return { keyId, keySecret }
}

const razorpay = async (env, path, method = 'GET', body) => {
  const { keyId, keySecret } = razorpayCredentials(env)
  const response = await fetch(`${razorpayBase}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(
      result?.error?.description || `Razorpay returned ${response.status}`,
    )
  }
  return result
}

const planKey = (planId, interval) =>
  `RAZORPAY_PLAN_${planId.toUpperCase()}_${interval.toUpperCase()}`

const firebaseCerts = async () => {
  if (firebaseCertificates && Date.now() < certificateExpiry)
    return firebaseCertificates
  const response = await fetch(firebaseCertUrl)
  if (!response.ok) throw new Error('Could not verify sign-in')
  firebaseCertificates = await response.json()
  const maxAge = Number(
    response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 300,
  )
  certificateExpiry = Date.now() + maxAge * 1000
  return firebaseCertificates
}

export const isApprovedFirebaseSignIn = (claims) =>
  claims.firebase?.sign_in_provider === 'google.com' &&
  claims.email_verified === true

const signedInUser = async (request, db, env) => {
  const token = request.headers.authorization?.match(/^Bearer (.+)$/i)?.[1]
  if (!token || !env.FIREBASE_PROJECT_ID) throw new Error('Sign in to continue')
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Sign in to continue')
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
  const now = Math.floor(Date.now() / 1000)
  if (
    header.alg !== 'RS256' ||
    !header.kid ||
    claims.aud !== env.FIREBASE_PROJECT_ID ||
    claims.iss !==
      `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}` ||
    typeof claims.sub !== 'string' ||
    !claims.sub ||
    !Number.isInteger(claims.exp) ||
    claims.exp <= now ||
    !Number.isInteger(claims.iat) ||
    claims.iat > now ||
    !Number.isInteger(claims.auth_time) ||
    claims.auth_time > now ||
    !isApprovedFirebaseSignIn(claims)
  )
    throw new Error('Sign in to continue')
  const cert = (await firebaseCerts())[header.kid]
  if (
    !cert ||
    !verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      new X509Certificate(cert).publicKey,
      Buffer.from(parts[2], 'base64url'),
    )
  ) {
    throw new Error('Sign in to continue')
  }
  const { data, error } = await db
    .from('app_users')
    .select('id, name, email, active_subscription_id')
    .eq('firebase_uid', claims.sub)
    .is('archived_at', null)
    .maybeSingle()
  if (
    error ||
    !data ||
    data.email.toLowerCase() !== String(claims.email).toLowerCase()
  )
    throw new Error('Account was not found')
  return data
}

const currentSubscription = async (db, id) => {
  if (!id) return null
  const { data, error } = await db
    .from('user_subscriptions')
    .select(
      'id, plan_id, billing_interval, status, current_period_end, provider_subscription_id, payment_provider',
    )
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  return data
}

const terminalRazorpayStatuses = new Set(['cancelled', 'completed', 'expired'])

const cancelRazorpayNow = async (env, providerSubscriptionId) => {
  const remote = await razorpay(env, `/subscriptions/${providerSubscriptionId}`)
  if (!terminalRazorpayStatuses.has(remote.status)) {
    await razorpay(
      env,
      `/subscriptions/${providerSubscriptionId}/cancel`,
      'POST',
      { cancel_at_cycle_end: false },
    )
  }
  return remote
}

export const paidPeriod = (subscription) => {
  const start = Number(subscription.current_start)
  const end = Number(subscription.current_end)
  if (
    !['active', 'authenticated'].includes(subscription.status) ||
    Number(subscription.paid_count) < 1 ||
    !start ||
    !end ||
    end * 1000 <= Date.now()
  ) {
    return null
  }
  return {
    start: new Date(start * 1000).toISOString(),
    end: new Date(end * 1000).toISOString(),
  }
}

const settleCheckout = async (db, env, checkout) => {
  const subscription = await razorpay(
    env,
    `/subscriptions/${checkout.provider_subscription_id}`,
  )
  const period = paidPeriod(subscription)
  if (!period) return { pending: true }
  if (subscription.plan_id !== checkout.provider_plan_id)
    throw new Error('The charged plan does not match checkout')

  const old = await currentSubscription(db, checkout.previous_subscription_id)
  if (old?.payment_provider === 'razorpay' && old.provider_subscription_id) {
    await cancelRazorpayNow(env, old.provider_subscription_id)
  }

  const { data, error } = await db.rpc('activate_razorpay_checkout', {
    p_provider_subscription_id: checkout.provider_subscription_id,
    p_provider_customer_id: subscription.customer_id || '',
    p_period_start: period.start,
    p_period_end: period.end,
  })
  if (error) throw new Error(error.message)
  return { pending: false, subscriptionId: data }
}

export const startSubscription = async (request, env = process.env) => {
  if (env.RAZORPAY_BILLING_ENABLED !== 'true')
    return fail(503, 'Paid subscriptions are not available yet')
  try {
    const db = database(env)
    const user = await signedInUser(request, db, env)
    const { planId, billingInterval } = request.body || {}
    if (
      !['basic', 'advanced', 'pro'].includes(planId) ||
      !['monthly', 'yearly'].includes(billingInterval)
    )
      return fail(400, 'Choose a paid plan and billing interval')

    const { data: plan, error: planError } = await db
      .from('subscription_plans')
      .select('id, monthly_price_inr, yearly_price_inr, is_active')
      .eq('id', planId)
      .single()
    if (planError || !plan?.is_active)
      return fail(400, 'This plan is not available')
    const old = await currentSubscription(db, user.active_subscription_id)
    if (
      old?.plan_id === planId &&
      old.billing_interval === billingInterval &&
      old.status === 'active' &&
      new Date(old.current_period_end).getTime() > Date.now()
    ) {
      return fail(409, 'This is already your active plan')
    }

    const providerPlanId = env[planKey(planId, billingInterval)]?.trim()
    if (!isId(providerPlanId, 'plan'))
      return fail(503, 'Razorpay plan mapping is not configured')
    const providerPlan = await razorpay(env, `/plans/${providerPlanId}`)
    const expectedAmount =
      Number(
        plan[
          billingInterval === 'monthly'
            ? 'monthly_price_inr'
            : 'yearly_price_inr'
        ],
      ) * 100
    if (
      providerPlan.item?.amount !== expectedAmount ||
      providerPlan.item?.currency !== 'INR' ||
      providerPlan.period !== billingInterval ||
      Number(providerPlan.interval) !== 1
    ) {
      return fail(503, 'Razorpay plan price does not match the plan catalogue')
    }

    const { data: open, error: openError } = await db
      .from('subscription_checkouts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'created')
      .order('created_at', { ascending: false })
      .limit(1)
    if (openError) throw new Error(openError.message)
    if (open?.length) {
      const pending = open[0]
      const remote = await razorpay(
        env,
        `/subscriptions/${pending.provider_subscription_id}`,
      )
      if (paidPeriod(remote)) {
        await settleCheckout(db, env, pending)
        return fail(
          409,
          'Your previous payment was completed. Refresh your plan and try again.',
        )
      }
      if (['cancelled', 'completed', 'expired'].includes(remote.status)) {
        const { error: cancelError } = await db
          .from('subscription_checkouts')
          .update({ status: 'cancelled' })
          .eq('id', pending.id)
        if (cancelError) throw new Error(cancelError.message)
      } else if (remote.status !== 'created') {
        return fail(
          409,
          'Your previous payment is still being confirmed. Refresh your plan shortly.',
        )
      } else {
        if (
          pending.plan_id === planId &&
          pending.billing_interval === billingInterval
        ) {
          return {
            status: 200,
            body: {
              keyId: env.RAZORPAY_KEY_ID,
              subscriptionId: pending.provider_subscription_id,
            },
          }
        }
        await razorpay(
          env,
          `/subscriptions/${pending.provider_subscription_id}/cancel`,
          'POST',
          { cancel_at_cycle_end: false },
        )
        const { error: cancelError } = await db
          .from('subscription_checkouts')
          .update({ status: 'cancelled' })
          .eq('id', pending.id)
        if (cancelError) throw new Error(cancelError.message)
      }
    }

    const created = await razorpay(env, '/subscriptions', 'POST', {
      plan_id: providerPlanId,
      total_count: billingInterval === 'monthly' ? 120 : 10,
      quantity: 1,
      customer_notify: false,
      notes: {
        app_user_id: user.id,
        app_plan: planId,
        app_interval: billingInterval,
      },
    })
    if (!isId(created.id, 'sub'))
      throw new Error('Razorpay did not create a subscription')
    const { error: saveError } = await db
      .from('subscription_checkouts')
      .insert({
        user_id: user.id,
        plan_id: planId,
        billing_interval: billingInterval,
        provider_plan_id: providerPlanId,
        provider_subscription_id: created.id,
        previous_subscription_id: user.active_subscription_id,
      })
    if (saveError) {
      await razorpay(env, `/subscriptions/${created.id}/cancel`, 'POST', {
        cancel_at_cycle_end: false,
      }).catch(() => {})
      throw new Error(saveError.message)
    }
    return {
      status: 200,
      body: { keyId: env.RAZORPAY_KEY_ID, subscriptionId: created.id },
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not start checkout'
    return fail(message === 'Sign in to continue' ? 401 : 500, message)
  }
}

export const chooseFreeSubscription = async (request, env = process.env) => {
  try {
    const db = database(env)
    const user = await signedInUser(request, db, env)
    const current = await currentSubscription(db, user.active_subscription_id)
    if (current?.plan_id !== 'free')
      return fail(409, 'A paid subscription must be changed through checkout')

    const { data: open, error: openError } = await db
      .from('subscription_checkouts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'created')
    if (openError) throw new Error(openError.message)
    for (const pending of open || []) {
      const remote = await razorpay(
        env,
        `/subscriptions/${pending.provider_subscription_id}`,
      )
      if (paidPeriod(remote)) {
        await settleCheckout(db, env, pending)
        return fail(
          409,
          'Your payment has already completed. Refresh your plan.',
        )
      }
      if (!['cancelled', 'completed', 'expired'].includes(remote.status)) {
        await razorpay(
          env,
          `/subscriptions/${pending.provider_subscription_id}/cancel`,
          'POST',
          { cancel_at_cycle_end: false },
        )
      }
      const { error } = await db
        .from('subscription_checkouts')
        .update({ status: 'cancelled' })
        .eq('id', pending.id)
      if (error) throw new Error(error.message)
    }
    const { error } = await db
      .from('app_users')
      .update({ plan_choice_completed_at: new Date().toISOString() })
      .eq('id', user.id)
    if (error) throw new Error(error.message)
    return { status: 200, body: { active: true } }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not choose Free'
    return fail(message === 'Sign in to continue' ? 401 : 500, message)
  }
}

export const cancelPaidSubscription = async (request, env = process.env) => {
  try {
    const db = database(env)
    const user = await signedInUser(request, db, env)
    const current = await currentSubscription(db, user.active_subscription_id)
    if (!current || current.plan_id === 'free')
      return fail(409, 'No paid subscription is active')

    const { data: open, error: openError } = await db
      .from('subscription_checkouts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'created')
    if (openError) throw new Error(openError.message)
    for (const pending of open || []) {
      const remote = await razorpay(
        env,
        `/subscriptions/${pending.provider_subscription_id}`,
      )
      if (paidPeriod(remote))
        return fail(
          409,
          'A payment has completed. Refresh your plan before cancelling.',
        )
      if (!terminalRazorpayStatuses.has(remote.status))
        await cancelRazorpayNow(env, pending.provider_subscription_id)
      const { error } = await db
        .from('subscription_checkouts')
        .update({ status: 'cancelled' })
        .eq('id', pending.id)
        .eq('status', 'created')
      if (error) throw new Error(error.message)
    }

    if (current.payment_provider === 'razorpay') {
      if (!isId(current.provider_subscription_id, 'sub'))
        throw new Error('The Razorpay subscription ID is missing')
      await cancelRazorpayNow(env, current.provider_subscription_id)
    }

    const { data: deletedDebts, error } = await db.rpc(
      'cancel_paid_subscription_to_free',
      {
        p_user_id: user.id,
        p_expected_subscription_id: current.id,
      },
    )
    if (error) throw new Error(error.message)
    return {
      status: 200,
      body: { active: true, deletedDebts: Number(deletedDebts || 0) },
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not cancel subscription'
    return fail(message === 'Sign in to continue' ? 401 : 500, message)
  }
}

export const confirmSubscription = async (request, env = process.env) => {
  try {
    const db = database(env)
    const user = await signedInUser(request, db, env)
    const { subscriptionId, paymentId, signature } = request.body || {}
    if (!isId(subscriptionId, 'sub') || !isId(paymentId, 'pay'))
      return fail(400, 'Invalid payment response')
    const { data: checkout, error } = await db
      .from('subscription_checkouts')
      .select('*')
      .eq('provider_subscription_id', subscriptionId)
      .eq('user_id', user.id)
      .single()
    if (error || !checkout) return fail(404, 'Checkout not found')
    if (
      !verifyCheckoutSignature(
        paymentId,
        checkout.provider_subscription_id,
        signature,
        razorpayCredentials(env).keySecret,
      )
    )
      return fail(400, 'Payment signature did not match')
    const result = await settleCheckout(db, env, checkout)
    return {
      status: result.pending ? 202 : 200,
      body: result.pending
        ? { pending: true, message: 'Payment is being confirmed by Razorpay' }
        : { active: true },
    }
  } catch (error) {
    return fail(
      500,
      error instanceof Error ? error.message : 'Could not confirm payment',
    )
  }
}

export const subscriptionWebhook = async (
  rawBody,
  signature,
  env = process.env,
) => {
  try {
    const secret = env.RAZORPAY_WEBHOOK_SECRET?.trim()
    if (!secret) return fail(503, 'Webhook is not configured')
    if (!verifyWebhookSignature(rawBody, signature, secret))
      return fail(401, 'Invalid webhook signature')
    const event = JSON.parse(rawBody)
    const providerId = event?.payload?.subscription?.entity?.id
    if (!isId(providerId, 'sub')) return { status: 200, body: { ok: true } }
    const db = database(env)
    const { data: checkout, error: checkoutError } = await db
      .from('subscription_checkouts')
      .select('*')
      .eq('provider_subscription_id', providerId)
      .maybeSingle()
    if (checkoutError) throw new Error(checkoutError.message)
    if (
      checkout?.status === 'created' &&
      ['subscription.activated', 'subscription.charged'].includes(event.event)
    ) {
      await settleCheckout(db, env, checkout)
    }
    const { data: active, error: activeError } = await db
      .from('user_subscriptions')
      .select('id, user_id')
      .eq('provider_subscription_id', providerId)
      .maybeSingle()
    if (activeError) throw new Error(activeError.message)
    if (active) {
      const { data: person, error: personError } = await db
        .from('app_users')
        .select('active_subscription_id')
        .eq('id', active.user_id)
        .single()
      if (personError) throw new Error(personError.message)
      if (person?.active_subscription_id === active.id) {
        const remote = await razorpay(env, `/subscriptions/${providerId}`)
        const period = paidPeriod(remote)
        const status = ['cancelled', 'completed'].includes(remote.status)
          ? 'cancelled'
          : ['pending', 'halted'].includes(remote.status)
            ? 'past_due'
            : period
              ? 'active'
              : 'past_due'
        const changes = { status, updated_at: new Date().toISOString() }
        if (period) {
          changes.current_period_start = period.start
          changes.current_period_end = period.end
        }
        const { error } = await db
          .from('user_subscriptions')
          .update(changes)
          .eq('id', active.id)
        if (error) throw new Error(error.message)
      }
    }
    return { status: 200, body: { ok: true } }
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : 'Webhook failed')
  }
}
