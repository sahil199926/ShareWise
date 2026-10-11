import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.SUPABASE_URL?.trim() ?? ''
const supabaseKey = import.meta.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey)

const missingSupabase = () => {
  throw new Error(
    'Supabase env is missing. Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY, then rebuild.',
  )
}

export const supabase: SupabaseClient = supabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : new Proxy({} as SupabaseClient, {
      get() {
        missingSupabase()
      },
    })
