import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authAPI } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

export default function GoogleCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setSessionFromStorage } = useAuth()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const codeParam = searchParams.get('code')
    const error = searchParams.get('error')
    if (error) {
      setErrorMessage(searchParams.get('error_description') || error)
      setStatus('error')
      return
    }
    if (!codeParam) {
      setErrorMessage('No authorization code received')
      setStatus('error')
      return
    }
    authAPI.exchangeGoogleCode(codeParam).then((result) => {
      if (result.twoFactorRequired && result.temporaryToken && result.user) {
        navigate('/auth/verify-2fa', { state: { temporaryToken: result.temporaryToken, user: result.user }, replace: true })
        return
      }
      if (result.token) {
        setSessionFromStorage()
        navigate('/dashboard', { replace: true })
        return
      }
      setErrorMessage(result.error || 'Sign-in failed')
      setStatus('error')
    }).catch(() => {
      setErrorMessage('Sign-in failed')
      setStatus('error')
    })
  }, [searchParams, navigate, setSessionFromStorage])

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
        <p className="text-red-600 mb-4">{errorMessage}</p>
        <button type="button" onClick={() => navigate('/login', { replace: true })} className="btn-primary">Back to login</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-800" />
      <p className="mt-4 text-gray-600">Completing sign-in...</p>
    </div>
  )
}
