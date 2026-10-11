import { signInWithGooglePopup } from '../lib/firebase'
import { supabase } from '../lib/supabase'
import type { User } from '../types/auth'

const toUser = (value: unknown): User => {
  const user = value as Partial<User>

  if (!user?.email || !user.name) {
    throw new Error('Could not sign in')
  }

  return {
    name: user.name,
    email: user.email,
    type: user.type ?? 'User',
    age: user.age ?? null,
    score: user.score ?? null,
  }
}

export const signInWithGoogle = async () => {
  const profile = await signInWithGooglePopup()
  return loginWithGoogle(profile.email, profile.googleId)
}

const loginWithGoogle = async (email: string, googleId: string) => {
  const { data, error } = await supabase.rpc('login_with_google', {
    p_email: email,
    p_google_id: googleId,
  })

  if (error || !data) {
    const message = error?.message ?? ''
    throw new Error(
      message.includes('login_with_google') || message.includes('schema cache')
        ? 'Google sign-in is not ready yet. Run the latest supabase/schema.sql in the SQL editor, then try again.'
        : message || 'This Google account is not on the people list',
    )
  }

  return toUser(data)
}
