import { useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo'
import { Mail, User, Building2, CheckCircle2 } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3002/api')

export default function WaitlistPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const res = await fetch(`${API_BASE_URL}/auth/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), company: company.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.')
      }
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col">
      {/* Top bar with logo */}
      <div className="py-4 px-6 border-b border-surface-200 bg-white shrink-0">
        <Link to="/" className="inline-block">
          <Logo height={40} />
        </Link>
      </div>

      {/* Centered content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-xl border border-surface-300 shadow-card p-8">
          {submitted ? (
            <div className="text-center py-6">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">You're on the list!</h1>
              <p className="text-gray-500 mb-6">
                Thanks for your interest in Costra. We'll reach out when your spot is ready.
              </p>
              <Link
                to="/"
                className="text-accent-600 hover:text-accent-500 font-semibold transition-colors"
              >
                Back to home
              </Link>
            </div>
          ) : (
            <>
              {/* Title Section */}
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Join the Waitlist</h1>
                <p className="text-gray-500">
                  Be among the first to simplify your multi-cloud cost management.
                </p>
              </div>

              {/* Waitlist Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name Input */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-2">
                    Full name
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 text-gray-900 placeholder-gray-400 bg-white transition-colors"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                </div>

                {/* Email Input */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-2">
                    Work email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 text-gray-900 placeholder-gray-400 bg-white transition-colors"
                      placeholder="you@company.com"
                      required
                    />
                  </div>
                </div>

                {/* Company Input */}
                <div>
                  <label htmlFor="company" className="block text-sm font-medium text-gray-900 mb-2">
                    Company <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="company"
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 text-gray-900 placeholder-gray-400 bg-white transition-colors"
                      placeholder="Acme Inc."
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full btn-primary py-3 px-4 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Joining...</span>
                    </>
                  ) : (
                    <span>Join Waitlist</span>
                  )}
                </button>
              </form>

              {/* Sign In Link */}
              <p className="mt-8 text-center text-sm text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="text-accent-600 hover:text-accent-500 font-semibold transition-colors">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
