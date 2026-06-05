import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../app-header'
import Pagination from '../pagination'
import UserFormModal from '../user-form-modal'
import UsersTable from '../users-table'
import { SHEETS_PAGE_SIZE } from '../../constants/pagination'
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
} from '../../services/users.service'
import type { MasterUser, MasterUserInput } from '../../types/master-user'
import type { PaginationMeta } from '../../types/sheet'
import { useAuth } from '../../hooks/use-auth'
import { isSameUserEmail } from '../../lib/auth-utils'

const Master = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [users, setUsers] = useState<MasterUser[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: SHEETS_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingUser, setEditingUser] = useState<MasterUser | undefined>()

  const reloadUsers = useCallback(
    (page: number) => {
      if (!user?.email) return

      listUsers(user.email, page)
        .then((result) => {
          setUsers(result.users)
          setPagination(result.pagination)
          setError('')
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load users')
        })
        .finally(() => {
          setIsLoading(false)
        })
    },
    [user],
  )

  useEffect(() => {
    reloadUsers(currentPage)
  }, [currentPage, reloadUsers])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handlePageChange = (page: number) => {
    setIsLoading(true)
    setCurrentPage(page)
  }

  const openCreateModal = () => {
    setModalMode('create')
    setEditingUser(undefined)
    setIsModalOpen(true)
  }

  const openEditModal = (user: MasterUser) => {
    setModalMode('edit')
    setEditingUser(user)
    setIsModalOpen(true)
  }

  const handleSubmit = async (data: MasterUserInput) => {
    setIsSubmitting(true)
    setIsLoading(true)

    if (!user?.email) return

    try {
      if (modalMode === 'create') {
        await createUser(user.email, data)
        setCurrentPage(1)
        reloadUsers(1)
      } else if (editingUser) {
        await updateUser(user.email, editingUser.rowId, data)
        reloadUsers(currentPage)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (targetUser: MasterUser) => {
    if (user?.email && isSameUserEmail(user.email, targetUser.email)) {
      setError('You cannot delete your own account.')
      return
    }

    const confirmed = window.confirm(
      `Delete user "${targetUser.name}" (${targetUser.email})?`,
    )

    if (!confirmed || !user?.email) return

    setIsLoading(true)

    try {
      await deleteUser(user.email, targetUser.rowId)
      reloadUsers(currentPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
      setIsLoading(false)
    }
  }

  return (
    <div className="page-shell">
      <AppHeader
        title="MASTER Sheet"
        subtitle="USERS · EMAIL · PASSWORD · TYPE · Age · Score"
        onLogout={handleLogout}
        actions={
          <button
            type="button"
            onClick={openCreateModal}
            className="btn-primary"
          >
            Add user
          </button>
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error ? <div className="alert-error mb-6">{error}</div> : null}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="skeleton h-12" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-divider bg-surface px-6 py-16 text-center">
            <p className="text-sm font-medium text-medium">No users found</p>
            <p className="mt-1 text-sm text-low">
              Add your first user to the MASTER sheet.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="btn-primary mt-4"
            >
              Add user
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-low">{pagination.total} users total</p>
            </div>

            <UsersTable
              users={users}
              currentUserEmail={user?.email}
              onEdit={openEditModal}
              onDelete={handleDelete}
            />

            <div className="mt-6">
              <Pagination
                pagination={pagination}
                onPageChange={handlePageChange}
                isLoading={isLoading}
                itemLabel="users"
              />
            </div>
          </>
        )}
      </main>

      <UserFormModal
        key={`${modalMode}-${editingUser?.rowId ?? 'new'}`}
        isOpen={isModalOpen}
        mode={modalMode}
        initialData={editingUser}
        isSubmitting={isSubmitting}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

export default Master
