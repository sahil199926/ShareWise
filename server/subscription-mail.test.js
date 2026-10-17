import assert from 'node:assert/strict'
import test from 'node:test'
import { cancellationMail } from './subscription-mail.js'
import { sendMail } from './mail.js'

test('cancellation email describes the final Free state and escapes names', () => {
  const mail = cancellationMail(
    { name: '<Sahil>', email: 'sahil@example.com' },
    { id: 'sub-record-123', plan_id: 'pro', payment_provider: 'razorpay' },
    2,
    new Date('2026-10-17T12:00:00Z'),
  )
  assert.equal(mail.to, 'sahil@example.com')
  assert.equal(mail.idempotencyKey, 'subscription-cancelled/sub-record-123')
  assert.match(mail.subject, /Pro subscription was cancelled/)
  assert.match(mail.text, /Razorpay subscription was cancelled immediately/)
  assert.match(mail.text, /2 older shared debt records were permanently deleted/)
  assert.match(mail.text, /30 new debts per month/)
  assert.match(mail.html, /&lt;Sahil&gt;/)
  assert.doesNotMatch(mail.html, /Hi <Sahil>/)
})

test('Resend receives one cancellation message with an idempotency key', async () => {
  const originalFetch = globalThis.fetch
  let request
  globalThis.fetch = async (_url, options) => {
    request = options
    return { ok: true }
  }
  try {
    const message = cancellationMail(
      { name: 'Sahil', email: 'sahil@example.com' },
      { id: 'sub-record-456', plan_id: 'basic', payment_provider: null },
      0,
    )
    const result = await sendMail(
      { RESEND_API_KEY: 're_test', MAIL_FROM: 'notify@example.com' },
      message,
    )
    assert.equal(result.sent, true)
    assert.equal(
      request.headers['Idempotency-Key'],
      'subscription-cancelled/sub-record-456',
    )
    assert.deepEqual(JSON.parse(request.body).to, ['sahil@example.com'])
    assert.match(JSON.parse(request.body).text, /No shared debt records were deleted/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
