import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppHeader from '../app-header'
import ExpenseSheetView, { REMOVE_ANIMATION_MS } from '../expense-sheet-view'
import { useAuth } from '../../hooks/use-auth'
import { useExpenseSheet } from '../../hooks/use-expense-sheet'
import {
  addItemToDraft,
  addUserToDraft,
  computeLiveSummary,
  removeItemFromDraft,
  removeUserFromDraft,
  toExpenseSheetDraft,
  toExpenseSheetSavePayload,
} from '../../lib/expense-sheet-utils'
import { getShareSheetPath } from '../../lib/sheet-urls'
import { listMasterUserOptions } from '../../services/sheets.service'
import { updateExpenseSheet } from '../../services/expense-sheet.service'
import type { MasterUserOption } from '../../types/sheet'
import type { ExpenseSheetUpdateInput } from '../../types/expense-sheet'

type EditSheetContentProps = {
  sheetId: string
  requesterEmail: string
}

const EditSheetContent = ({
  sheetId,
  requesterEmail,
}: EditSheetContentProps) => {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const {
    data: sheetData,
    setData,
    error,
    isLoading,
  } = useExpenseSheet(sheetId, requesterEmail)

  const [localDraft, setLocalDraft] = useState<ExpenseSheetUpdateInput | null>(
    null,
  )
  const [masterUsers, setMasterUsers] = useState<MasterUserOption[]>([])
  const [masterUsersLoaded, setMasterUsersLoaded] = useState(false)
  const [removingUsers, setRemovingUsers] = useState<Set<string>>(new Set())
  const [removingItems, setRemovingItems] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [success, setSuccess] = useState('')

  const draft = useMemo(() => {
    if (localDraft) return localDraft
    if (!sheetData) return null
    return toExpenseSheetDraft(sheetData)
  }, [localDraft, sheetData])

  const liveSummary = useMemo(() => {
    if (!draft) return null

    return computeLiveSummary(draft.users, draft.items, draft.given)
  }, [draft])

  useEffect(() => {
    if (masterUsersLoaded) return

    let cancelled = false

    listMasterUserOptions(requesterEmail)
      .then((users) => {
        if (cancelled) return

        setMasterUsers(users)
        setMasterUsersLoaded(true)
      })
      .catch(() => {
        if (!cancelled) {
          setMasterUsersLoaded(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [requesterEmail, masterUsersLoaded])

  const updateDraft = (nextDraft: ExpenseSheetUpdateInput) => {
    setLocalDraft(nextDraft)
  }

  const handleAddUser = (userName: string) => {
    if (!draft) return
    updateDraft(addUserToDraft(draft, userName))
  }

  const handleAddItem = (name: string) => {
    if (!draft) return
    updateDraft(addItemToDraft(draft, name))
  }

  const handleRemoveUser = (userName: string) => {
    if (!draft || draft.users.length <= 1) return

    setRemovingUsers((current) => new Set(current).add(userName))

    window.setTimeout(() => {
      setLocalDraft((current) => {
        const base = current ?? draft
        return removeUserFromDraft(base, userName)
      })
      setRemovingUsers((current) => {
        const next = new Set(current)
        next.delete(userName)
        return next
      })
    }, REMOVE_ANIMATION_MS)
  }

  const handleRemoveItem = (clientId: string) => {
    if (!draft || draft.items.length <= 1) return

    setRemovingItems((current) => new Set(current).add(clientId))

    window.setTimeout(() => {
      setLocalDraft((current) => {
        const base = current ?? draft
        return removeItemFromDraft(base, clientId)
      })
      setRemovingItems((current) => {
        const next = new Set(current)
        next.delete(clientId)
        return next
      })
    }, REMOVE_ANIMATION_MS)
  }

  const handleSave = async () => {
    if (!draft) return

    const hasEmptyItem = draft.items.some((item) => !item.name.trim())
    if (hasEmptyItem) {
      setSaveError('Every item needs a name before saving.')
      return
    }

    setIsSaving(true)
    setSaveError('')
    setSuccess('')

    try {
      const updated = await updateExpenseSheet(
        sheetId,
        requesterEmail,
        toExpenseSheetSavePayload(draft),
      )
      setData(updated)
      setLocalDraft(null)
      setSuccess('Changes saved to Google Sheets.')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save sheet')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="page-shell pb-28">
      <AppHeader
        title="Edit sheet"
        onLogout={handleLogout}
        actions={
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading || !draft}
            className="btn-primary"
          >
            {isSaving ? 'Saving...' : 'Save changes'}
          </button>
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/dashboard" className="text-sm font-medium text-accent">
            ← Back to dashboard
          </Link>

          <Link
            to={getShareSheetPath(sheetId)}
            state={{ sheet: { id: sheetId, name: sheetData?.name ?? '' } }}
            className="btn-secondary"
          >
            Share view
          </Link>
        </div>

        {error ? <div className="alert-error mt-6">{error}</div> : null}
        {saveError ? <div className="alert-error mt-6">{saveError}</div> : null}
        {success ? <div className="alert-success mt-6">{success}</div> : null}

        {isLoading ? (
          <div className="mt-6 space-y-4">
            <div className="skeleton h-28" />
            <div className="skeleton h-64" />
          </div>
        ) : sheetData && draft && liveSummary ? (
          <div className="mt-6 space-y-6">
            <div className="card p-6 sm:p-8">
              <p className="section-label">Sheet editor</p>
              <h2 className="mt-2 text-2xl font-semibold text-high sm:text-3xl">
                {sheetData.name}
              </h2>
              <p className="mt-2 text-sm text-low">
                Add or remove users and items, edit amounts, then save to sync
                with Google Sheets.
              </p>
            </div>

            <ExpenseSheetView
              data={sheetData}
              mode="edit"
              summary={liveSummary}
              draft={draft}
              onDraftChange={updateDraft}
              masterUserOptions={masterUsers}
              removingUsers={removingUsers}
              removingItems={removingItems}
              onAddUser={handleAddUser}
              onAddItem={handleAddItem}
              onRemoveUser={handleRemoveUser}
              onRemoveItem={handleRemoveItem}
            />
          </div>
        ) : null}
      </main>

      {draft ? (
        <div className="expense-save-bar expense-animate-in">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <p className="text-sm text-low">
              {draft.users.length} users · {draft.items.length} items
            </p>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="btn-primary px-8"
            >
              {isSaving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const EditSheet = () => {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  if (!id || !user?.email) {
    return null
  }

  return <EditSheetContent key={id} sheetId={id} requesterEmail={user.email} />
}

export default EditSheet
