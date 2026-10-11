import { SHEETS_PAGE_SIZE } from '../constants/pagination'
import { supabase } from '../lib/supabase'
import type { MasterUser, MasterUserInput } from '../types/master-user'
import type { PaginationMeta } from '../types/pagination'
import type { MasterUserOption } from '../types/user-option'

type UserListResult = {
  users: MasterUser[]
  pagination: PaginationMeta
}

const missingPeopleMessage =
  'People table is missing in Supabase. Open the SQL editor and run supabase/schema.sql again, then refresh.'

const explain = (message: string | undefined, fallback: string) => {
  if (
    message?.includes('app_users') ||
    message?.includes('schema cache') ||
    message?.includes('Could not find the function')
  ) {
    return missingPeopleMessage
  }

  return message || fallback
}

export const listUsers = async (
  requesterEmail: string,
  page = 1,
  pageSize = SHEETS_PAGE_SIZE,
) => {
  const { data, error } = await supabase.rpc('list_users', {
    p_requester_email: requesterEmail,
    p_page: page,
    p_page_size: pageSize,
  })

  if (error || !data) {
    throw new Error(explain(error?.message, 'Failed to load people'))
  }

  const result = data as UserListResult

  if (!result.users || !result.pagination) {
    throw new Error('Failed to load people')
  }

  return result
}

export const createUser = async (
  requesterEmail: string,
  user: MasterUserInput,
) => {
  const { data, error } = await supabase.rpc('create_user', {
    p_requester_email: requesterEmail,
    p_name: user.name,
    p_email: user.email,
    p_password: user.password,
    p_type: user.type,
    p_age: user.age,
    p_score: user.score,
  })

  if (error || !data) {
    throw new Error(explain(error?.message, 'Failed to add person'))
  }

  return data as MasterUser
}

export const updateUser = async (
  requesterEmail: string,
  id: string,
  user: MasterUserInput,
) => {
  const { data, error } = await supabase.rpc('update_user', {
    p_requester_email: requesterEmail,
    p_id: id,
    p_name: user.name,
    p_password: user.password,
    p_type: user.type,
    p_age: user.age,
    p_score: user.score,
  })

  if (error || !data) {
    throw new Error(explain(error?.message, 'Failed to update person'))
  }

  return data as MasterUser
}

export const deleteUser = async (requesterEmail: string, id: string) => {
  const { error } = await supabase.rpc('delete_user', {
    p_requester_email: requesterEmail,
    p_id: id,
  })

  if (error) {
    throw new Error(explain(error.message, 'Failed to delete person'))
  }
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

export const listLeaderboardFaces = async (emails: string[]) => {
  const unique = [
    ...new Set(
      emails.map((email) => email.trim().toLowerCase()).filter(Boolean),
    ),
  ]

  const faces = await Promise.all(
    unique.map(async (email) => {
      const { data, error } = await supabase.rpc('get_profile', {
        p_email: email,
      })

      if (error || !data || typeof data !== 'object') return null

      const avatarUrl = (data as { avatarUrl?: string | null }).avatarUrl
      return [
        email,
        avatarUrl?.startsWith('https://') ? avatarUrl : null,
      ] as const
    }),
  )

  return Object.fromEntries(
    faces.filter((face): face is readonly [string, string | null] =>
      Boolean(face),
    ),
  )
}

export const listMasterUserOptions = async (requesterEmail: string) => {
  const { data, error } = await supabase.rpc('list_user_options', {
    p_requester_email: requesterEmail,
  })

  if (error || !data) {
    throw new Error(explain(error?.message, 'Failed to load people'))
  }

  return data as MasterUserOption[]
}
