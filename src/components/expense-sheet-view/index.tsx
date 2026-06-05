import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { MasterUserOption } from '../../types/sheet'
import type {
  ExpenseSheetData,
  ExpenseSheetDraftItem,
  ExpenseSheetSummary,
  ExpenseSheetUpdateInput,
} from '../../types/expense-sheet'
import { formatAmount, getPendingTone } from '../../lib/expense-sheet-utils'

const REMOVE_ANIMATION_MS = 320

type ExpenseSheetViewProps = {
  data: ExpenseSheetData
  mode: 'view' | 'edit'
  summary: ExpenseSheetSummary
  draft?: ExpenseSheetUpdateInput
  onDraftChange?: (draft: ExpenseSheetUpdateInput) => void
  masterUserOptions?: MasterUserOption[]
  removingUsers?: Set<string>
  removingItems?: Set<string>
  onRemoveUser?: (userName: string) => void
  onRemoveItem?: (clientId: string) => void
  onAddUser?: (userName: string) => void
  onAddItem?: (name: string) => void
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
  masterUserOptions = [],
  removingUsers = new Set(),
  removingItems = new Set(),
  onRemoveUser,
  onRemoveItem,
  onAddUser,
  onAddItem,
}: ExpenseSheetViewProps) => {
  const [newItemName, setNewItemName] = useState('')
  const isEdit = mode === 'edit' && draft && onDraftChange

  const users = isEdit ? draft.users : data.users
  const items: ExpenseSheetDraftItem[] = isEdit
    ? draft.items
    : data.items.map((item) => ({
        clientId: String(item.rowIndex),
        rowIndex: item.rowIndex,
        name: item.name,
        shares: item.shares,
        paidBy: item.paidBy,
        comments: item.comments,
      }))

  const availableUsers = masterUserOptions.filter(
    (option) => !users.includes(option.name),
  )

  const updateShare = (clientId: string, userName: string, value: string) => {
    if (!draft || !onDraftChange) return

    const nextValue = value === '' ? 0 : Number(value)

    onDraftChange({
      ...draft,
      items: draft.items.map((item) =>
        item.clientId === clientId
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
    clientId: string,
    field: 'name' | 'paidBy' | 'comments',
    value: string,
  ) => {
    if (!draft || !onDraftChange) return

    onDraftChange({
      ...draft,
      items: draft.items.map((item) =>
        item.clientId === clientId ? { ...item, [field]: value } : item,
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

  const getItemRowTotal = (item: ExpenseSheetDraftItem) => {
    return users.reduce((sum, user) => sum + (item.shares[user] || 0), 0)
  }

  const handleAddItem = () => {
    if (!onAddItem) return

    onAddItem(newItemName)
    setNewItemName('')
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-high">Balances</h3>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-low">
              {users.length} participant{users.length === 1 ? '' : 's'}
            </span>
            {isEdit ? (
              availableUsers.length > 0 ? (
                <select
                  defaultValue=""
                  onChange={(event) => {
                    const value = event.target.value
                    if (value && onAddUser) {
                      onAddUser(value)
                      event.target.value = ''
                    }
                  }}
                  className="expense-action-select"
                  aria-label="Add user from MASTER"
                >
                  <option value="" disabled>
                    + Add user
                  </option>
                  {availableUsers.map((option) => (
                    <option key={option.email} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-low">
                  All MASTER users added ·{' '}
                  <Link to="/master" className="font-medium text-accent">
                    Add in MASTER Sheet
                  </Link>
                </span>
              )
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {users.map((user) => {
            const pending = summary.pending[user] || 0
            const tone = getPendingTone(pending)
            const isRemoving = removingUsers.has(user)

            return (
              <article
                key={user}
                className={`expense-balance-card expense-animate-item ${
                  isRemoving ? 'expense-animate-out' : 'expense-animate-in'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-high">{user}</p>
                    <p className="mt-1 text-xs text-low">Participant</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`expense-pending-pill ${pendingToneClass[tone]}`}
                    >
                      {pending > 0 ? '+' : ''}
                      {formatAmount(pending)}
                    </span>
                    {isEdit && users.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => onRemoveUser?.(user)}
                        disabled={isRemoving}
                        className="expense-remove-btn"
                        aria-label={`Remove ${user}`}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
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
        {isEdit ? (
          <div className="flex flex-col gap-3 border-b border-divider px-4 py-4 sm:flex-row sm:items-center">
            <input
              type="text"
              value={newItemName}
              onChange={(event) => setNewItemName(event.target.value)}
              placeholder="New item name"
              className="input-field max-w-xs"
            />
            <button
              type="button"
              onClick={handleAddItem}
              className="btn-secondary shrink-0"
            >
              + Add item
            </button>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="expense-table min-w-full">
            <thead>
              <tr className="expense-row-header">
                <th>items</th>
                {users.map((user) => (
                  <th key={user}>{user}</th>
                ))}
                <th>total</th>
                <th>Price</th>
                <th>paid by</th>
                <th>Comments</th>
                {isEdit ? <th className="w-12" /> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const rowTotal = getItemRowTotal(item)
                const isRemoving = removingItems.has(item.clientId)

                return (
                  <tr
                    key={item.clientId}
                    className={`expense-row-item expense-animate-item ${
                      isRemoving ? 'expense-animate-out' : 'expense-animate-in'
                    }`}
                  >
                    <td className="font-semibold text-high">
                      {isEdit ? (
                        <input
                          type="text"
                          value={item.name}
                          onChange={(event) =>
                            updateItemField(
                              item.clientId,
                              'name',
                              event.target.value,
                            )
                          }
                          className="expense-cell-input font-semibold"
                        />
                      ) : (
                        item.name
                      )}
                    </td>
                    {users.map((user) => (
                      <td key={user}>
                        {isEdit ? (
                          <input
                            type="number"
                            value={item.shares[user] ?? 0}
                            onChange={(event) =>
                              updateShare(
                                item.clientId,
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
                          value={item.paidBy}
                          onChange={(event) =>
                            updateItemField(
                              item.clientId,
                              'paidBy',
                              event.target.value,
                            )
                          }
                          className="expense-cell-input"
                        >
                          <option value="">—</option>
                          {users.map((user) => (
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
                          value={item.comments}
                          onChange={(event) =>
                            updateItemField(
                              item.clientId,
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
                    {isEdit ? (
                      <td>
                        {items.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => onRemoveItem?.(item.clientId)}
                            disabled={isRemoving}
                            className="expense-remove-btn"
                            aria-label={`Remove ${item.name}`}
                          >
                            ×
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                )
              })}

              <tr className="expense-row-total">
                <td className="font-bold">TOTAL</td>
                {users.map((user) => (
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
                <td colSpan={isEdit ? 3 : 2} />
              </tr>

              <tr className="expense-row-given">
                <td className="font-bold">GIVEN</td>
                {users.map((user) => (
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
                <td colSpan={isEdit ? 3 : 2} />
              </tr>

              <tr className="expense-row-pending">
                <td className="font-bold">pending</td>
                {users.map((user) => {
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
                <td colSpan={isEdit ? 3 : 2} />
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export { REMOVE_ANIMATION_MS }
export default ExpenseSheetView
