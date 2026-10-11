import { useCallback, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { APP_NAME } from '../../constants/brand'
import { useAuth } from '../../hooks/use-auth'
import { firebaseReady } from '../../lib/firebase'
import { signInWithGoogle } from '../../services/auth.service'
import KarjaArt from '../karja-art'
import LazyFallback from '../lazy-fallback'
import Logo from '../logo'

const Login = () => {
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login, isAuthenticated, isBootstrapping } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from =
    (location.state as { from?: { pathname: string } } | null)?.from
      ?.pathname ?? '/dashboard'

  const finishSignIn = useCallback(
    (attempt: Promise<Awaited<ReturnType<typeof signInWithGoogle>>>) => {
      setError('')
      setIsSubmitting(true)

      void attempt
        .then((user) => {
          login(user)
          navigate(from, { replace: true })
        })
        .catch((err: unknown) => {
          const code =
            err && typeof err === 'object' && 'code' in err
              ? String(err.code)
              : ''

          if (code === 'auth/popup-closed-by-user') {
            setError('')
            return
          }

          setError(err instanceof Error ? err.message : 'Login failed')
        })
        .finally(() => {
          setIsSubmitting(false)
        })
    },
    [from, login, navigate],
  )

  const handleGoogleSignIn = () => {
    finishSignIn(signInWithGoogle())
  }

  if (isBootstrapping) {
    return <LazyFallback />
  }

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="glass-card overflow-hidden p-6 lg:p-8">
          <p className="section-label">Karja, kept simple</p>
          <h2 className="mt-2 max-w-sm text-2xl font-semibold tracking-tight text-high sm:text-3xl">
            See who owes, who receives, and what is already closed.
          </h2>
          <KarjaArt className="mx-auto mt-2 h-48 w-full max-w-md sm:h-64 lg:h-80" />
        </div>
        <div className="glass-card w-full p-8 sm:p-10">
          <div className="flex justify-center">
            <Logo size="lg" />
          </div>
          <h1 className="mt-6 text-center text-2xl font-semibold text-high">
            Sign in
          </h1>
          <p className="mt-2 text-center text-sm text-low">
            Welcome back to {APP_NAME}
          </p>

          <div className="mt-8 space-y-4">
            {error ? <p className="alert-error">{error}</p> : null}

            {firebaseReady ? (
              <button
                type="button"
                className="btn-secondary flex min-h-11 w-full items-center justify-center gap-3 bg-white/80"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
              >
                <GoogleMark />
                {isSubmitting ? 'Signing in…' : 'Continue with Google'}
              </button>
            ) : (
              <p className="alert-error">
                Add the Firebase web app keys in .env, then restart the app. In
                Firebase, open Project settings, Your apps, and copy the config
                for karja-app.
              </p>
            )}

            <p className="text-center text-sm text-low">
              Sign in with the Google account that matches your Karja email. The
              first time, that Google id is saved on your person.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

const GoogleMark = () => (
  <svg viewBox="0 0 18 18" className="size-4" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18Z"
    />
    <path
      fill="#FBBC05"
      d="M3.98 10.72A5.41 5.41 0 0 1 3.7 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.02-2.33Z"
    />
    <path
      fill="#EA4335"
      d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
    />
  </svg>
)

export default Login
