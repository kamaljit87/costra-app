import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { authAPI } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import Logo from '../components/Logo'

export default function Verify2FAPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setSessionFromStorage } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const state = location.state as { temporaryToken?: string; user?: { id: number; name: string; email: string; avatarUrl?: string } } | null
  const temporaryToken = state?.temporaryToken

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!temporaryToken || !code.trim()) {
      setError('Please enter the 6-digit code from your authenticator app.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await authAPI.verify2FA(temporaryToken, code.trim())
      setSessionFromStorage()
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!temporaryToken) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
        <Link to="/" className="inline-block mb-6">
          <Logo height={40} />
        </Link>
        <p className="text-gray-600 mb-4">This page is only available after signing in.</p>
        <Link to="/login" className="text-accent-600 hover:underline">Back to login</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="py-4 px-6 border-b border-surface-200 bg-white">
        <Link to="/" className="inline-block">
          <Logo height={40} />
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Two-factor authentication</h1>
          <p className="text-gray-600 text-sm mb-6">
            Enter the 6-digit code from your authenticator app to complete sign-in.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-lg tracking-widest focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
              disabled={submitting}
            />
            {error && (
              <p className="text-red-600 text-sm" role="alert">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting || code.length !== 6}
              className="w-full btn-primary py-3"
            >
              {submitting ? 'Verifying…' : 'Verify'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">
            <Link to="/login" className="text-accent-600 hover:underline">Back to login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
