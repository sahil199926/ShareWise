import { signInWithGooglePopup } from '../lib/firebase'
import { supabase } from '../lib/supabase'
import type { AuthContextPayload } from '../types/auth'

export const signInWithGoogle = async (returnPath = '/dashboard') => {
  sessionStorage.setItem('karja_auth_return_path', returnPath)
  await signInWithGooglePopup()
}

export const getMyContext = async () => {
  const { data, error } = await supabase.rpc('get_my_context')
  if (error || !data) {
    throw new Error(error?.message || 'Could not load your groups')
  }
  return data as AuthContextPayload
}
