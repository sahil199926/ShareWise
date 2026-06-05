import {
  PAYMENT_STATUS,
  PAYMENT_STATUS_LABELS,
  type PaymentStatus,
} from '../../constants/payment-status'

const STATUS_CLASS: Record<PaymentStatus, string> = {
  [PAYMENT_STATUS.NOT_PAID]: 'payment-status-not-paid',
  [PAYMENT_STATUS.PAY_REQUESTED]: 'payment-status-requested',
  [PAYMENT_STATUS.PAID]: 'payment-status-paid',
}

type PaymentStatusBadgeProps = {
  status: PaymentStatus
}

const PaymentStatusBadge = ({ status }: PaymentStatusBadgeProps) => {
  return (
    <span className={`payment-status-badge ${STATUS_CLASS[status]}`}>
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  )
}

export default PaymentStatusBadge
