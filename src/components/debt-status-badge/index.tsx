import { DEBT_STATUS, type DebtStatus } from '../../types/debt'

const STATUS_CLASS: Record<DebtStatus, string> = {
  [DEBT_STATUS.OPEN]: 'status-open',
  [DEBT_STATUS.CLOSE_REQUESTED]: 'status-requested',
  [DEBT_STATUS.CLOSED]: 'status-closed',
}

const STATUS_LABEL: Record<DebtStatus, string> = {
  [DEBT_STATUS.OPEN]: 'Open',
  [DEBT_STATUS.CLOSE_REQUESTED]: 'Close requested',
  [DEBT_STATUS.CLOSED]: 'Closed',
}

type DebtStatusBadgeProps = {
  status: DebtStatus
}

const DebtStatusBadge = ({ status }: DebtStatusBadgeProps) => {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

export default DebtStatusBadge
