import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authAPI } from '../services/api'

export default function GoogleCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    if (error) {
      setErrorMessage(searchParams.get('error_description') || error)
      setStatus('error')
      return
    }
    if (!code) {
      setErrorMessage('No authorization code received')
      setStatus('error')
      return
    }
    authAPI.exchangeGoogleCode(code).then((result) => {
      if (result.token) navigate('/dashboard', { replace: true })
      else {
        setErrorMessage(result.error || 'Sign-in failed')
        setStatus('error')
      }
    }).catch(() => {
      setErrorMessage('Sign-in failed')
      setStatus('error')
    })
  }, [searchParams, navigate])

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
