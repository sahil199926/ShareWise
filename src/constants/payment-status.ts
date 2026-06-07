export const PAYMENT_STATUS = {
  NOT_PAID: 'Not Paid',
  PAY_REQUESTED: 'Requested paid',
  PAID: 'Paid',
} as const

export type PaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS]

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  [PAYMENT_STATUS.NOT_PAID]: 'Not Paid',
  [PAYMENT_STATUS.PAY_REQUESTED]: 'Requested paid',
  [PAYMENT_STATUS.PAID]: 'Paid',
}
