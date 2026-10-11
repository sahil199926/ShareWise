import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useMemo } from 'react'
import { getUserTypeBadgeClass } from '../../constants/user-types'
import { isSameUserEmail } from '../../lib/auth-utils'
import type { MasterUser } from '../../types/master-user'

const formatCell = (value: string | number | null) => {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

type UsersTableProps = {
  users: MasterUser[]
  currentUserEmail?: string
  onEdit: (user: MasterUser) => void
  onDelete: (user: MasterUser) => void
}

const columnHelper = createColumnHelper<MasterUser>()

const UserActions = ({
  person,
  currentUserEmail,
  onEdit,
  onDelete,
}: {
  person: MasterUser
  currentUserEmail?: string
  onEdit: (user: MasterUser) => void
  onDelete: (user: MasterUser) => void
}) => {
  const isCurrentUser =
    currentUserEmail && isSameUserEmail(currentUserEmail, person.email)

  return (
    <div className="flex items-center justify-end gap-2">
      {isCurrentUser ? <span className="text-xs text-low">You</span> : null}
      <button
        type="button"
        onClick={() => onEdit(person)}
        className="btn-ghost px-3 py-1.5 text-xs"
      >
        Edit
      </button>
      {isCurrentUser ? null : (
        <button
          type="button"
          onClick={() => onDelete(person)}
          className="btn-danger"
        >
          Delete
        </button>
      )}
    </div>
  )
}

const UsersTable = ({
  users,
  currentUserEmail,
  onEdit,
  onDelete,
}: UsersTableProps) => {
  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'USERS',
        cell: (info) => (
          <span className="font-medium text-high">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('email', {
        header: 'EMAIL',
        cell: (info) => <span className="text-medium">{info.getValue()}</span>,
      }),
      columnHelper.accessor('type', {
        header: 'TYPE',
        cell: (info) => {
          const value = formatCell(info.getValue())
          return (
            <span className={getUserTypeBadgeClass(info.getValue())}>
              {value}
            </span>
          )
        },
      }),
      columnHelper.accessor('age', {
        header: 'Age',
        cell: (info) => formatCell(info.getValue()),
      }),
      columnHelper.accessor('score', {
        header: 'Score',
        cell: (info) => (
          <span className="font-medium text-accent">
            {formatCell(info.getValue())}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <UserActions
            person={row.original}
            currentUserEmail={currentUserEmail}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ),
      }),
    ],
    [currentUserEmail, onDelete, onEdit],
  )

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <>
      <div className="space-y-3 md:hidden">
        {users.map((person) => (
          <article key={person.email} className="glass-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-high">{person.name}</p>
                <p className="mt-1 text-sm break-all text-medium">
                  {person.email}
                </p>
              </div>
              <span className={getUserTypeBadgeClass(person.type)}>
                {formatCell(person.type)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-medium">
              <p>
                Age {formatCell(person.age)} · Score {formatCell(person.score)}
              </p>
              <UserActions
                person={person}
                currentUserEmail={currentUserEmail}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
          </article>
        ))}
      </div>

      <div className="table-shell hidden md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-divider">
            <thead className="table-head">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="table-cell text-left">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-divider">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="table-row">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="table-cell">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default UsersTable
