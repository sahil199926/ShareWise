import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/use-auth'
import { loginWithSheet } from '../../services/auth.service'
import LazyFallback from '../lazy-fallback'
import Logo from '../logo'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { login, isAuthenticated, isBootstrapping } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from =
    (location.state as { from?: { pathname: string } } | null)?.from
      ?.pathname ?? '/dashboard'

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const user = await loginWithSheet(email, password)
      login(user)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isBootstrapping) {
    return <LazyFallback />
  }

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4">
      <div className="card w-full max-w-md p-8">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>
        <h1 className="mt-6 text-center text-2xl font-semibold text-high">
          Sign in
        </h1>
        <p className="mt-2 text-center text-sm text-low">
          Welcome back to your expense tracker
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {error ? <p className="alert-error">{error}</p> : null}

          <div>
            <label htmlFor="email" className="field-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input-field"
              placeholder="you@example.com"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="password" className="field-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-field"
              placeholder="••••••••"
              required
              disabled={isSubmitting}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full py-2.5"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
