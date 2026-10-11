import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/auth-provider'
import { ThemeProvider } from './context/theme-provider'
import { supabaseConfigured } from './lib/supabase'
import Layout from './layout'

const App = () => {
  if (!supabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="glass-card w-full max-w-md p-8 text-center">
          <h1 className="text-xl font-semibold text-high">
            Supabase keys are missing
          </h1>
          <p className="mt-3 text-sm text-low">
            In Vercel, add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY, then
            redeploy. Leave the secret key off this site.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Layout />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
