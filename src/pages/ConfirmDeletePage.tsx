import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Logo from '../components/Logo'

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3002/api')

export default function ConfirmDeletePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [keepForMarketing, setKeepForMarketing] = useState(false)

  if (!token) {
    return (
      <div className="min-h-screen bg-surface-100 flex flex-col">
        <div className="py-4 px-6 border-b border-surface-200 bg-white">
          <Link to="/" className="inline-block"><Logo height={40} /></Link>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-surface-200 shadow-xl p-8 text-center">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid Link</h1>
            <p className="text-sm text-gray-500 mb-4">This deletion link is invalid or has expired.</p>
            <Link to="/login" className="btn-primary inline-block text-center w-full">
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/compliance/delete-account/confirm-by-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, keepForMarketing }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setResult('success')
        setMessage(data.message || 'Account deleted successfully.')
        // Clear local auth state
        localStorage.removeItem('authToken')
        localStorage.removeItem('user')
      } else {
        setResult('error')
        setMessage(data.error || 'Failed to delete account.')
      }
    } catch {
      setResult('error')
      setMessage('Unable to connect. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (result === 'success') {
    return (
      <div className="min-h-screen bg-surface-100 flex flex-col">
        <div className="py-4 px-6 border-b border-surface-200 bg-white">
          <Link to="/" className="inline-block"><Logo height={40} /></Link>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-surface-200 shadow-xl p-8 text-center">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Account Deleted</h1>
            <p className="text-sm text-gray-500 mb-6">{message}</p>
            <Link to="/" className="btn-primary inline-block text-center w-full">
              Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col">
      <div className="py-4 px-6 border-b border-surface-200 bg-white">
        <Link to="/" className="inline-block"><Logo height={40} /></Link>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white border border-surface-200 shadow-xl p-8">
          <h1 className="text-xl font-semibold text-red-600 mb-2">Confirm Account Deletion</h1>
          <p className="text-sm text-gray-600 mb-4">
            You are about to permanently delete your Costdoq account and all associated data. This action cannot be undone.
          </p>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-800 font-medium mb-2">This will permanently delete:</p>
            <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
              <li>All cloud provider connections</li>
              <li>All cost data and recommendations</li>
              <li>All budgets, reports, and settings</li>
              <li>Your account and profile</li>
            </ul>
          </div>

          <label className="flex items-start gap-2 mb-6 cursor-pointer">
            <input
              type="checkbox"
              checked={keepForMarketing}
              onChange={(e) => setKeepForMarketing(e.target.checked)}
              className="mt-1 rounded border-gray-300"
            />
            <span className="text-xs text-gray-500">
              Keep my email for occasional product updates (you can unsubscribe anytime)
            </span>
          </label>

          {result === 'error' && <p className="text-sm text-red-600 mb-4">{message}</p>}

          <div className="flex gap-3">
            <Link to="/dashboard" className="flex-1 px-4 py-2 text-center text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg">
              Cancel
            </Link>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Deleting...' : 'Delete My Account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
