import { SHEETS_PAGE_SIZE } from '../constants/pagination'
import { supabase } from '../lib/supabase'
import type { MasterUser, MasterUserInput } from '../types/master-user'
import type { PaginationMeta } from '../types/pagination'
import type { MasterUserOption } from '../types/user-option'

type UserListResult = { users: MasterUser[]; pagination: PaginationMeta }

const explain = (message: string | undefined, fallback: string) =>
  message?.includes('schema cache') || message?.includes('list_group_')
    ? 'The secure group database migration has not been applied yet.'
    : message || fallback

export const listUsers = async (
  groupId: string,
  page = 1,
  pageSize = SHEETS_PAGE_SIZE,
) => {
  const { data, error } = await supabase.rpc('list_group_users', {
    p_group_id: groupId,
    p_page: page,
    p_page_size: pageSize,
  })
  if (error || !data)
    throw new Error(explain(error?.message, 'Failed to load people'))
  const result = data as UserListResult
  if (!result.users || !result.pagination)
    throw new Error('Failed to load people')
  return result
}

export const createUser = async (groupId: string, user: MasterUserInput) => {
  const { data, error } = await supabase.rpc('create_group_user', {
    p_group_id: groupId,
    p_name: user.name,
    p_email: user.email,
    p_role: user.type === 'SUPER ADMIN' ? 'admin' : 'member',
  })
  if (error || !data)
    throw new Error(explain(error?.message, 'Failed to add person'))
  return data as MasterUser
}

export const updateUser = async (
  groupId: string,
  id: string,
  user: MasterUserInput,
) => {
  const { data, error } = await supabase.rpc('update_group_user', {
    p_group_id: groupId,
    p_user_id: id,
    p_name: user.name,
    p_age: user.age,
    p_score: user.score,
    p_role: user.type === 'SUPER ADMIN' ? 'admin' : 'member',
  })
  if (error || !data)
    throw new Error(explain(error?.message, 'Failed to update person'))
  return data as MasterUser
}

export const deleteUser = async (groupId: string, id: string) => {
  const { error } = await supabase.rpc('delete_group_user', {
    p_group_id: groupId,
    p_user_id: id,
    p_delete_history: true,
  })
  if (error) throw new Error(explain(error.message, 'Failed to delete person'))
}

export const avatarForEmail = (
  email: string,
  faces: Record<string, string | null>,
  session?: { email: string; avatarUrl?: string | null } | null,
) => {
  const key = email.trim().toLowerCase()
  const sessionPhoto =
    session?.email.trim().toLowerCase() === key &&
    session.avatarUrl?.startsWith('https://')
      ? session.avatarUrl
      : null
  return sessionPhoto || faces[key] || null
}

export const listMasterUserOptions = async (groupId: string) => {
  const { data, error } = await supabase.rpc('list_group_user_options', {
    p_group_id: groupId,
  })
  if (error || !data)
    throw new Error(explain(error?.message, 'Failed to load people'))
  return data as MasterUserOption[]
}

export const listLeaderboardFaces = async (
  groupId: string,
  emails: string[],
) => {
  const wanted = new Set(emails.map((email) => email.trim().toLowerCase()))
  const options = await listMasterUserOptions(groupId)
  return Object.fromEntries(
    options
      .filter((person) => wanted.has(person.email.trim().toLowerCase()))
      .map((person) => [
        person.email.trim().toLowerCase(),
        'avatarUrl' in person && typeof person.avatarUrl === 'string'
          ? person.avatarUrl
          : null,
      ]),
  )
}
