import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../app-header'
import ConfirmModal from '../confirm-modal'
import Pagination from '../pagination'
import { PeopleTableSkeleton } from '../skeleton'
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
import type { PaginationMeta } from '../../types/pagination'
import { useAuth } from '../../hooks/use-auth'
import { isSameUserEmail } from '../../lib/auth-utils'
import { deleteGroup, leaveGroup } from '../../services/groups.service'

const Master = () => {
  const { user, activeGroup, refreshContext, logout } = useAuth()
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
  const [userToDelete, setUserToDelete] = useState<MasterUser | null>(null)
  const [groupAction, setGroupAction] = useState<'delete' | 'leave' | null>(
    null,
  )

  const canManage =
    activeGroup?.role === 'owner' || activeGroup?.role === 'admin'

  const reloadUsers = useCallback(
    (page: number) => {
      if (!activeGroup) return

      listUsers(activeGroup.id, page)
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
    [activeGroup],
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

    if (!activeGroup) return

    try {
      if (modalMode === 'create') {
        await createUser(activeGroup.id, data)
        await refreshContext()
        setCurrentPage(1)
        reloadUsers(1)
      } else if (editingUser) {
        await updateUser(activeGroup.id, editingUser.id, data)
        await refreshContext()
        reloadUsers(currentPage)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const askDelete = (targetUser: MasterUser) => {
    if (user?.email && isSameUserEmail(user.email, targetUser.email)) {
      setError('You cannot delete your own account.')
      return
    }

    setUserToDelete(targetUser)
  }

  const handleDelete = async () => {
    if (!userToDelete || !activeGroup) return

    setIsLoading(true)

    try {
      await deleteUser(activeGroup.id, userToDelete.id)
      setUserToDelete(null)
      reloadUsers(currentPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
      setIsLoading(false)
    }
  }

  const handleGroupAction = async () => {
    if (!activeGroup || !groupAction) return
    setIsLoading(true)
    setError('')
    try {
      if (groupAction === 'delete') await deleteGroup(activeGroup.id)
      else await leaveGroup(activeGroup.id)
      setGroupAction(null)
      await refreshContext()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Group action failed')
      setIsLoading(false)
    }
  }

  return (
    <div className="page-shell">
      <AppHeader
        title="Group details"
        subtitle="Group settings, capacity, and members"
        onLogout={handleLogout}
        actions={
          canManage ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="btn-primary"
            >
              Add user
            </button>
          ) : undefined
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error ? <div className="alert-error mb-6">{error}</div> : null}

        {activeGroup ? (
          <section className="card mb-6 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="section-label">Current group</p>
                <h2 className="mt-2 text-xl font-semibold text-high">
                  {activeGroup.name}
                </h2>
                <p className="mt-1 text-sm capitalize text-low">
                  Your role: {activeGroup.role}
                </p>
              </div>
              <div className="rounded-2xl bg-emerald/8 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-low">
                  Member capacity
                </p>
                <p className="mt-1 text-lg font-semibold text-high">
                  {pagination.total} of {activeGroup.memberLimit}
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 border-t border-divider pt-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-low">
                  Subscription controller
                </p>
                <p className="mt-1 text-sm font-medium text-high">
                  {activeGroup.subscriptionOwner.name}
                </p>
                <p className="text-xs text-low">
                  {activeGroup.subscriptionOwner.email} ·{' '}
                  {activeGroup.subscription.plan} plan
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-low">
                  Debt capacity
                </p>
                <p className="mt-1 text-sm font-medium text-high">
                  {activeGroup.subscription.monthlyDebtUsed.toLocaleString(
                    'en-IN',
                  )}{' '}
                  of{' '}
                  {activeGroup.subscription.monthlyDebtLimit.toLocaleString(
                    'en-IN',
                  )}{' '}
                  this month
                </p>
              </div>
            </div>
            {activeGroup.freezeReason ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Existing data is safe, but new debts are frozen:{' '}
                {activeGroup.freezeReason}
              </div>
            ) : null}
          </section>
        ) : null}

        {isLoading ? (
          <PeopleTableSkeleton />
        ) : users.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-divider bg-surface px-6 py-16 text-center">
            <p className="text-sm font-medium text-medium">No users found</p>
            <p className="mt-1 text-sm text-low">
              {canManage
                ? 'Add the first person who can sign in and hold karja.'
                : 'This group has no visible members yet.'}
            </p>
            {canManage ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="btn-primary mt-4"
              >
                Add user
              </button>
            ) : null}
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
              onDelete={askDelete}
              canManage={canManage}
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

        {activeGroup ? (
          <section className="mt-8 rounded-2xl border border-red-200 bg-red-50/70 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-red-800">
              {canManage ? 'Delete this group' : 'Leave this group'}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-red-700">
              {canManage
                ? 'This permanently deletes the group, all memberships, every debt, sheet import, share token, and audit detail in it.'
                : 'This permanently removes your membership and every debt in this group where you owe or receive money.'}
            </p>
            <button
              type="button"
              className="btn-danger mt-4"
              onClick={() => setGroupAction(canManage ? 'delete' : 'leave')}
            >
              {canManage ? 'Delete group' : 'Leave group'}
            </button>
          </section>
        ) : null}
      </main>

      <ConfirmModal
        isOpen={Boolean(userToDelete)}
        message={
          userToDelete
            ? `Permanently delete ${userToDelete.name} (${userToDelete.email}) from this group? All debts where this person owes or receives money will also be physically deleted. This cannot be undone.`
            : ''
        }
        isConfirming={isLoading}
        onCancel={() => {
          if (!isLoading) setUserToDelete(null)
        }}
        onConfirm={() => {
          void handleDelete()
        }}
      />

      <ConfirmModal
        isOpen={Boolean(groupAction)}
        title={
          groupAction === 'delete' ? 'Delete this group?' : 'Leave this group?'
        }
        message={
          groupAction === 'delete'
            ? `Permanently delete ${activeGroup?.name ?? 'this group'} and all of its members, debts, imports, shares, and history? This cannot be undone.`
            : `Permanently leave ${activeGroup?.name ?? 'this group'}? All debts involving you inside this group will be hard deleted. This cannot be undone.`
        }
        confirmLabel={groupAction === 'delete' ? 'Delete group' : 'Leave group'}
        pendingLabel={
          groupAction === 'delete' ? 'Deleting group…' : 'Leaving group…'
        }
        isConfirming={isLoading}
        onCancel={() => {
          if (!isLoading) setGroupAction(null)
        }}
        onConfirm={() => void handleGroupAction()}
      />

      {canManage ? (
        <UserFormModal
          key={`${modalMode}-${editingUser?.id ?? 'new'}`}
          isOpen={isModalOpen}
          mode={modalMode}
          initialData={editingUser}
          isSubmitting={isSubmitting}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  )
}

export default Master
