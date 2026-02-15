import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { SignInCard } from '../components/ui/travel-connect-signin-1'
import GoogleSignInButton from '../components/GoogleSignInButton'
import Logo from '../components/Logo'

export default function LoginTravelPage() {
  const navigate = useNavigate()
  const { login, pending2FA, complete2FALogin, clearPending2FA } = useAuth()
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)

  const handleSubmit = async (email: string, password: string) => {
    const success = await login(email, password)
    if (success) navigate('/dashboard')
  }

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setCodeError('')
    if (!code.trim()) {
      setCodeError('Enter the code from your authenticator app')
      return
    }
    setCodeLoading(true)
    try {
      const success = await complete2FALogin(code.trim())
      if (success) navigate('/dashboard')
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : 'Invalid code')
    } finally {
      setCodeLoading(false)
    }
  }

  if (pending2FA) {
    return (
      <div className="min-h-screen bg-surface-100 flex flex-col">
        <div className="py-4 px-6 border-b border-surface-200 bg-white">
          <Link to="/" className="inline-block">
            <Logo height={40} />
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-surface-200 shadow-xl p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Two-factor authentication</h2>
            <p className="text-sm text-gray-500 mb-6">
              Enter the 6-digit code from your authenticator app for {pending2FA.email}
            </p>
            <form onSubmit={handle2FAVerify} className="space-y-4">
              <div>
                <label htmlFor="totp-code" className="block text-sm font-medium text-gray-700 mb-1">
                  Authentication code
                </label>
                <input
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 border border-surface-200 rounded-lg bg-surface-50 text-gray-900 placeholder-gray-400"
                />
              </div>
              {codeError && (
                <p className="text-sm text-red-600">{codeError}</p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { clearPending2FA(); setCode(''); setCodeError('') }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={codeLoading}
                  className="flex-1 btn-primary"
                >
                  {codeLoading ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col">
      <div className="py-4 px-6 border-b border-surface-200 bg-white">
        <Link to="/" className="inline-block">
          <Logo height={40} />
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <SignInCard
            title="Costra"
            tagline="Sign in to your cost dashboard and connect all your cloud providers"
            forgotPasswordHref="/forgot-password"
            onSubmit={handleSubmit}
            googleButton={<GoogleSignInButton mode="signin" />}
          />
          <p className="mt-6 text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="text-accent-600 hover:text-accent-700 font-medium">
              Sign up for free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
