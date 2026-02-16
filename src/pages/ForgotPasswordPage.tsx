import { useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }
    setLoading(true)
    try {
      const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3002/api')
      const res = await fetch(`${apiBase}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSubmitted(true)
      } else {
        setError(data.error || 'Something went wrong. Please try again or contact support.')
      }
    } catch {
      setError('Unable to connect. Please try again or contact support.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col">
      <div className="py-4 px-6 border-b border-surface-200 bg-white">
        <Link to="/" className="inline-block">
          <Logo height={40} />
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white border border-surface-200 shadow-xl p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Forgot password?</h1>
          <p className="text-sm text-gray-500 mb-6">
            Enter your email and we&apos;ll send you instructions to reset your password.
          </p>
          {submitted ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                If an account exists for that email, we&apos;ve sent reset instructions. Check your inbox and spam folder.
              </p>
              <Link to="/login" className="btn-primary inline-block text-center w-full">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-200 rounded-lg bg-surface-50 text-gray-900 placeholder-gray-400"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <Link to="/login" className="px-4 py-2 text-gray-600 hover:text-gray-900">
                  Back
                </Link>
                <button type="submit" disabled={loading} className="flex-1 btn-primary">
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
