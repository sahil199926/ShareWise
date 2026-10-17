type BillingResult = { status: number; body: Record<string, unknown> }
type BillingRequest = {
  headers: { authorization?: string }
  body: unknown
}

export function startSubscription(
  request: BillingRequest,
  env?: Record<string, string | undefined>,
): Promise<BillingResult>

export function chooseFreeSubscription(
  request: BillingRequest,
  env?: Record<string, string | undefined>,
): Promise<BillingResult>

export function cancelPaidSubscription(
  request: BillingRequest,
  env?: Record<string, string | undefined>,
): Promise<BillingResult>

export function confirmSubscription(
  request: BillingRequest,
  env?: Record<string, string | undefined>,
): Promise<BillingResult>

export function subscriptionWebhook(
  rawBody: Buffer,
  signature: string | string[] | undefined,
  env?: Record<string, string | undefined>,
): Promise<BillingResult>
