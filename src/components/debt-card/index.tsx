import { DEBT_STATUS, type Debt } from '../../types/debt'
import { formatDebtDate, formatRupee } from '../../lib/debt-utils'
import DebtStatusBadge from '../debt-status-badge'

type DebtCardProps = {
  debt: Debt
  currentUserEmail?: string
  isAdmin?: boolean
  actionLoading?: boolean
  onEdit?: (debt: Debt) => void
  onDelete?: (debt: Debt) => void
  onRequestClose?: (debt: Debt) => void
  onMarkClosed?: (debt: Debt) => void
  onReopen?: (debt: Debt) => void
}

const DebtCard = ({
  debt,
  currentUserEmail,
  isAdmin = false,
  actionLoading = false,
  onEdit,
  onDelete,
  onRequestClose,
  onMarkClosed,
  onReopen,
}: DebtCardProps) => {
  const email = currentUserEmail?.trim().toLowerCase()
  const isDebtor = Boolean(email) && debt.debtorEmail.toLowerCase() === email
  const isCreditor =
    Boolean(email) && debt.creditorEmail.toLowerCase() === email
  const canRequestClose =
    isDebtor && debt.status === DEBT_STATUS.OPEN && Boolean(onRequestClose)
  const toneClass = isDebtor
    ? 'debt-card-pay'
    : isCreditor
      ? 'debt-card-receive'
      : ''
  const amountClass = isDebtor
    ? 'text-[#b91c1c]'
    : isCreditor
      ? 'text-emerald-deep'
      : 'text-high'

  return (
    <article className={`glass-card p-5 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-2xl font-bold tracking-tight ${amountClass}`}>
            {formatRupee(debt.amount)}
          </p>
          <p className="mt-2 text-sm font-medium text-high">
            {debt.debtorName}{' '}
            <span className="font-normal text-low">will give</span>{' '}
            {debt.creditorName}
          </p>
        </div>
        <DebtStatusBadge status={debt.status} />
      </div>

      {debt.note ? (
        <p className="mt-3 text-sm text-medium">{debt.note}</p>
      ) : null}

      <p className="mt-4 text-xs text-low">
        Added {formatDebtDate(debt.createdAt)}
        {debt.status === DEBT_STATUS.CLOSE_REQUESTED
          ? ` · waiting for ${debt.creditorName} to confirm`
          : ''}
        {debt.status === DEBT_STATUS.CLOSED && debt.closedAt
          ? ` · closed ${formatDebtDate(debt.closedAt)}`
          : ''}
      </p>

      {canRequestClose || isAdmin ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {canRequestClose ? (
            <button
              type="button"
              onClick={() => onRequestClose?.(debt)}
              disabled={actionLoading}
              className="btn-secondary text-xs"
            >
              I paid — please close
            </button>
          ) : null}

          {isAdmin && debt.status !== DEBT_STATUS.CLOSED ? (
            <button
              type="button"
              onClick={() => onMarkClosed?.(debt)}
              disabled={actionLoading}
              className="btn-primary text-xs"
            >
              Mark closed
            </button>
          ) : null}

          {isAdmin && debt.status === DEBT_STATUS.CLOSE_REQUESTED ? (
            <button
              type="button"
              onClick={() => onReopen?.(debt)}
              disabled={actionLoading}
              className="btn-secondary text-xs"
            >
              Move to open
            </button>
          ) : null}

          {isAdmin && debt.status === DEBT_STATUS.CLOSED ? (
            <button
              type="button"
              onClick={() => onReopen?.(debt)}
              disabled={actionLoading}
              className="btn-secondary text-xs"
            >
              Reopen
            </button>
          ) : null}

          {isAdmin && onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(debt)}
              disabled={actionLoading}
              className="btn-ghost text-xs"
            >
              Edit
            </button>
          ) : null}

          {isAdmin && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(debt)}
              disabled={actionLoading}
              className="btn-danger"
            >
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

export default DebtCard
