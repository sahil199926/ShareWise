import type {
  ExpenseSheetData,
  ExpenseSheetSummary,
  ExpenseSheetUpdateInput,
} from '../../types/expense-sheet'
import { formatAmount, getPendingTone } from '../../lib/expense-sheet-utils'

type ExpenseSheetViewProps = {
  data: ExpenseSheetData
  mode: 'view' | 'edit'
  summary: ExpenseSheetSummary
  draft?: ExpenseSheetUpdateInput
  onDraftChange?: (draft: ExpenseSheetUpdateInput) => void
}

const pendingToneClass: Record<string, string> = {
  credit: 'expense-pending-credit',
  debit: 'expense-pending-debit',
  zero: 'expense-pending-zero',
}

const ExpenseSheetView = ({
  data,
  mode,
  summary,
  draft,
  onDraftChange,
}: ExpenseSheetViewProps) => {
  const isEdit = mode === 'edit' && draft && onDraftChange

  const updateShare = (rowIndex: number, userName: string, value: string) => {
    if (!draft || !onDraftChange) return

    const nextValue = value === '' ? 0 : Number(value)

    onDraftChange({
      ...draft,
      items: draft.items.map((item) =>
        item.rowIndex === rowIndex
          ? {
              ...item,
              shares: {
                ...item.shares,
                [userName]: Number.isNaN(nextValue) ? 0 : nextValue,
              },
            }
          : item,
      ),
    })
  }

  const updateItemField = (
    rowIndex: number,
    field: 'paidBy' | 'comments',
    value: string,
  ) => {
    if (!draft || !onDraftChange) return

    onDraftChange({
      ...draft,
      items: draft.items.map((item) =>
        item.rowIndex === rowIndex ? { ...item, [field]: value } : item,
      ),
    })
  }

  const updateGiven = (userName: string, value: string) => {
    if (!draft || !onDraftChange) return

    const nextValue = value === '' ? 0 : Number(value)

    onDraftChange({
      ...draft,
      given: {
        ...draft.given,
        [userName]: Number.isNaN(nextValue) ? 0 : nextValue,
      },
    })
  }

  const getDraftItem = (rowIndex: number) => {
    return draft?.items.find((item) => item.rowIndex === rowIndex)
  }

  const getItemRowTotal = (rowIndex: number) => {
    const draftItem = getDraftItem(rowIndex)

    if (draftItem) {
      return data.users.reduce(
        (sum, user) => sum + (draftItem.shares[user] || 0),
        0,
      )
    }

    const item = data.items.find((entry) => entry.rowIndex === rowIndex)
    return item?.total ?? 0
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-high">Balances</h3>
          <span className="text-sm text-low">
            {data.users.length} participant
            {data.users.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.users.map((user) => {
            const pending = summary.pending[user] || 0
            const tone = getPendingTone(pending)

            return (
              <article key={user} className="expense-balance-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-high">{user}</p>
                    <p className="mt-1 text-xs text-low">Participant</p>
                  </div>
                  <span
                    className={`expense-pending-pill ${pendingToneClass[tone]}`}
                  >
                    {pending > 0 ? '+' : ''}
                    {formatAmount(pending)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="expense-stat-box">
                    <p className="expense-stat-label">Total</p>
                    <p className="expense-stat-value">
                      {formatAmount(summary.total[user] || 0)}
                    </p>
                  </div>
                  <div className="expense-stat-box">
                    <p className="expense-stat-label">Given</p>
                    <p className="expense-stat-value">
                      {formatAmount(summary.given[user] || 0)}
                    </p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="expense-table-shell">
        <div className="overflow-x-auto">
          <table className="expense-table min-w-full">
            <thead>
              <tr className="expense-row-header">
                <th>items</th>
                {data.users.map((user) => (
                  <th key={user}>{user}</th>
                ))}
                <th>total</th>
                <th>Price</th>
                <th>paid by</th>
                <th>Comments</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => {
                const draftItem = getDraftItem(item.rowIndex)
                const rowTotal = getItemRowTotal(item.rowIndex)

                return (
                  <tr key={item.rowIndex} className="expense-row-item">
                    <td className="font-semibold text-high">{item.name}</td>
                    {data.users.map((user) => (
                      <td key={user}>
                        {isEdit ? (
                          <input
                            type="number"
                            value={draftItem?.shares[user] ?? 0}
                            onChange={(event) =>
                              updateShare(
                                item.rowIndex,
                                user,
                                event.target.value,
                              )
                            }
                            className="expense-cell-input"
                          />
                        ) : (
                          formatAmount(item.shares[user] || 0)
                        )}
                      </td>
                    ))}
                    <td className="font-medium">{formatAmount(rowTotal)}</td>
                    <td className="font-medium">{formatAmount(rowTotal)}</td>
                    <td>
                      {isEdit ? (
                        <select
                          value={draftItem?.paidBy ?? ''}
                          onChange={(event) =>
                            updateItemField(
                              item.rowIndex,
                              'paidBy',
                              event.target.value,
                            )
                          }
                          className="expense-cell-input"
                        >
                          <option value="">—</option>
                          {data.users.map((user) => (
                            <option key={user} value={user}>
                              {user}
                            </option>
                          ))}
                        </select>
                      ) : (
                        item.paidBy || '—'
                      )}
                    </td>
                    <td>
                      {isEdit ? (
                        <input
                          type="text"
                          value={draftItem?.comments ?? ''}
                          onChange={(event) =>
                            updateItemField(
                              item.rowIndex,
                              'comments',
                              event.target.value,
                            )
                          }
                          className="expense-cell-input"
                          placeholder="Add note"
                        />
                      ) : (
                        item.comments || '—'
                      )}
                    </td>
                  </tr>
                )
              })}

              <tr className="expense-row-total">
                <td className="font-bold">TOTAL</td>
                {data.users.map((user) => (
                  <td key={user} className="font-bold">
                    {formatAmount(summary.total[user] || 0)}
                  </td>
                ))}
                <td className="font-bold">
                  {formatAmount(summary.grandTotal)}
                </td>
                <td className="font-bold">
                  {formatAmount(summary.totalPrice)}
                </td>
                <td colSpan={2} />
              </tr>

              <tr className="expense-row-given">
                <td className="font-bold">GIVEN</td>
                {data.users.map((user) => (
                  <td key={user}>
                    {isEdit ? (
                      <input
                        type="number"
                        value={draft?.given[user] ?? 0}
                        onChange={(event) =>
                          updateGiven(user, event.target.value)
                        }
                        className="expense-cell-input"
                      />
                    ) : (
                      formatAmount(summary.given[user] || 0)
                    )}
                  </td>
                ))}
                <td className="font-bold">
                  {formatAmount(summary.givenTotal)}
                </td>
                <td colSpan={2} />
              </tr>

              <tr className="expense-row-pending">
                <td className="font-bold">pending</td>
                {data.users.map((user) => {
                  const pending = summary.pending[user] || 0
                  const tone = getPendingTone(pending)

                  return (
                    <td
                      key={user}
                      className={`font-bold ${pendingToneClass[tone]}`}
                    >
                      {pending > 0 ? '+' : ''}
                      {formatAmount(pending)}
                    </td>
                  )
                })}
                <td
                  className={`font-bold ${pendingToneClass[getPendingTone(summary.pendingTotal)]}`}
                >
                  {formatAmount(summary.pendingTotal)}
                </td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default ExpenseSheetView
