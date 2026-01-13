import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Google OAuth configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

interface GoogleSignInButtonProps {
  mode: 'signin' | 'signup'
}

export default function GoogleSignInButton({ mode }: GoogleSignInButtonProps) {
  const { googleLogin } = useAuth()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Load Google Identity Services script
    if (GOOGLE_CLIENT_ID && typeof window.google === 'undefined') {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  }, [])

  const handleGoogleSignIn = async () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Google OAuth is not configured. Please use email/password authentication.')
      return
    }

    try {
      setIsLoading(true)
      setError('')

      // Wait for Google script to load
      let attempts = 0
      while (typeof window.google === 'undefined' && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }

      if (typeof window.google === 'undefined') {
        throw new Error('Failed to load Google OAuth. Please refresh the page.')
      }

      // Initialize and render Google Sign In button
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCallback,
      })

      // Use one-tap sign-in
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback: render button manually
          const buttonContainer = document.getElementById('google-signin-button')
          if (buttonContainer) {
            window.google.accounts.id.renderButton(buttonContainer, {
              theme: 'outline',
              size: 'large',
              width: '100%',
            })
          }
        }
      })
    } catch (err: any) {
      console.error('Google sign-in error:', err)
      setError(err.message || 'Failed to initialize Google sign-in')
      setIsLoading(false)
    }
  }

  const handleGoogleCallback = async (response: any) => {
    try {
      setIsLoading(true)

      // Decode the credential (JWT)
      const credential = response.credential
      const base64Url = credential.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )

      const payload = JSON.parse(jsonPayload)

      // Authenticate with backend
      const success = await googleLogin(
        payload.sub,
        payload.name,
        payload.email,
        payload.picture
      )

      if (success) {
        navigate('/dashboard')
      } else {
        setError('Failed to complete Google sign-in')
      }
    } catch (err: any) {
      console.error('Google callback error:', err)
      setError(err.message || 'Failed to complete Google sign-in')
    } finally {
      setIsLoading(false)
    }
  }

  // Simplified approach: Direct OAuth flow
  const handleSimpleGoogleSignIn = async () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Google OAuth is not configured. Please use email/password authentication.')
      return
    }

    try {
      setIsLoading(true)
      setError('')

      // Use Google Identity Services One Tap
      if (typeof window.google !== 'undefined') {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,
        })
        window.google.accounts.id.prompt()
      } else {
        // Fallback: redirect to Google OAuth
        const redirectUri = encodeURIComponent(window.location.origin + '/auth/google/callback')
        const scope = encodeURIComponent('email profile')
        window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err)
      setError(err.message || 'Failed to initialize Google sign-in')
      setIsLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={handleSimpleGoogleSignIn}
        disabled={isLoading}
        className="w-full flex items-center justify-center space-x-3 px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700"></div>
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Continue with Google</span>
          </>
        )}
      </button>
      <div id="google-signin-button" className="mt-2"></div>
      {error && (
        <div className="mt-2 text-sm text-red-600 text-center">{error}</div>
      )}
    </>
  )
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    google: any
  }
}
