import { supabase } from '../lib/supabase'

export type NewGroupMember = { name: string; email: string }

export const createGroup = async (
  name: string,
  members: NewGroupMember[],
  memberLimit = 12,
) => {
  const { data, error } = await supabase.rpc('create_group', {
    p_name: name,
    p_members: members,
    p_member_limit: memberLimit,
  })
  if (error || !data)
    throw new Error(error?.message || 'Could not create group')
  return String(data)
}

export const leaveGroup = async (groupId: string) => {
  const { error } = await supabase.rpc('leave_group', { p_group_id: groupId })
  if (error) throw new Error(error.message || 'Could not leave group')
}

export const deleteGroup = async (groupId: string) => {
  const { error } = await supabase.rpc('delete_group', { p_group_id: groupId })
  if (error) throw new Error(error.message || 'Could not delete group')
}
