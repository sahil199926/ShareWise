import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'
import {
  paidPeriod,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from './billing.js'

test('verifies the Razorpay subscription checkout example and rejects substitution', () => {
  const secret = 'EnLs21M47BllR3X8PSFtjtbd'
  const signature =
    '601f383334975c714c91a7d97dd723eb56520318355863dcf3821c0d07a17693'
  assert.equal(
    verifyCheckoutSignature(
      'pay_IDZNwZZFtnjyym',
      'sub_ID6MOhgkcoHj9I',
      signature,
      secret,
    ),
    true,
  )
  assert.equal(
    verifyCheckoutSignature(
      'pay_IDZNwZZFtnjyym',
      'sub_different12345',
      signature,
      secret,
    ),
    false,
  )
  assert.equal(
    verifyCheckoutSignature(
      'pay_IDZNwZZFtnjyym',
      'sub_ID6MOhgkcoHj9I',
      'not-a-signature',
      secret,
    ),
    false,
  )
})

test('webhook verification uses the exact raw bytes', () => {
  const secret = 'webhook-test-secret'
  const raw = Buffer.from('{"event":"subscription.charged"}')
  const signature = createHmac('sha256', secret).update(raw).digest('hex')
  assert.equal(verifyWebhookSignature(raw, signature, secret), true)
  assert.equal(
    verifyWebhookSignature(
      Buffer.from('{ "event": "subscription.charged" }'),
      signature,
      secret,
    ),
    false,
  )
})

test('access needs a current charged subscription', () => {
  const subscription = {
    status: 'active',
    paid_count: 1,
    current_start: Math.floor(Date.now() / 1000) - 100,
    current_end: Math.floor(Date.now() / 1000) + 3600,
  }
  assert.ok(paidPeriod(subscription))
  assert.equal(paidPeriod({ ...subscription, paid_count: 0 }), null)
  assert.equal(paidPeriod({ ...subscription, status: 'pending' }), null)
  assert.equal(paidPeriod({ ...subscription, status: 'cancelled' }), null)
  assert.equal(paidPeriod({ ...subscription, current_end: 1 }), null)
})
