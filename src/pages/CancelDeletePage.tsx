import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Logo from '../components/Logo'

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3002/api')

export default function CancelDeletePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Missing cancellation token.')
      return
    }

    const cancel = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/compliance/delete-account/cancel-by-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          setStatus('success')
          setMessage(data.message || 'Deletion cancelled. Your account is safe.')
        } else {
          setStatus('error')
          setMessage(data.error || 'Cancellation failed. The link may have expired.')
        }
      } catch {
        setStatus('error')
        setMessage('Unable to connect. Please try again.')
      }
    }

    cancel()
  }, [token])

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col">
      <div className="py-4 px-6 border-b border-surface-200 bg-white">
        <Link to="/" className="inline-block"><Logo height={40} /></Link>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white border border-surface-200 shadow-xl p-8 text-center">
          {status === 'loading' && (
            <>
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-gray-900 mb-2">Cancelling deletion...</h1>
              <p className="text-sm text-gray-500">Please wait.</p>
            </>
          )}
          {status === 'success' && (
            <>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">Account Secured</h1>
              <p className="text-sm text-gray-500 mb-6">{message}</p>
              <Link to="/dashboard" className="btn-primary inline-block text-center w-full">
                Go to Dashboard
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">Cancellation Failed</h1>
              <p className="text-sm text-gray-500 mb-6">{message}</p>
              <Link to="/login" className="btn-primary inline-block text-center w-full">
                Go to Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
