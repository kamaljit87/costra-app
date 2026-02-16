import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../services/api'
import Logo from '../components/Logo'
import { Shield, ShieldCheck } from 'lucide-react'

type Step = 'loading' | 'prompt' | 'setup'

export default function Suggest2FAPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('loading')
  const [twoFASetup, setTwoFASetup] = useState<{ secret: string; otpauthUrl: string } | null>(null)
  const [confirmCode, setConfirmCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    authAPI.get2FAStatus().then((res) => {
      if (cancelled) return
      if (res.enabled) {
        navigate('/dashboard', { replace: true })
        return
      }
      setStep('prompt')
    }).catch(() => {
      if (!cancelled) setStep('prompt')
    })
    return () => { cancelled = true }
  }, [navigate])

  const handleEnable = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await authAPI.setup2FA()
      setTwoFASetup({ secret: res.secret, otpauthUrl: res.otpauthUrl })
      setConfirmCode('')
      setStep('setup')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start setup')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!confirmCode || confirmCode.length !== 6) {
      setError('Enter the 6-digit code from your app')
      return
    }
    setError('')
    setLoading(true)
    try {
      await authAPI.confirm2FA(confirmCode)
      setSuccess('Two-factor authentication is now enabled.')
      setTwoFASetup(null)
      setTimeout(() => navigate('/dashboard', { replace: true }), 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid code. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    navigate('/dashboard', { replace: true })
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
        <Link to="/" className="inline-block mb-6">
          <Logo height={40} />
        </Link>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-800" />
        <p className="mt-4 text-gray-600">Loading…</p>
      </div>
    )
  }

  if (step === 'prompt') {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <div className="py-4 px-6 border-b border-gray-200 bg-white">
          <Link to="/" className="inline-block">
            <Logo height={40} />
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent-100 text-accent-700 mb-6">
              <Shield className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Add an extra layer of security</h1>
            <p className="text-gray-600 text-sm mb-8">
              Enable two-factor authentication to protect your account. You’ll enter a code from your phone when signing in.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={handleEnable}
                disabled={loading}
                className="btn-primary py-3 px-6"
              >
                {loading ? 'Starting…' : 'Enable 2FA'}
              </button>
              <button
                type="button"
                onClick={handleSkip}
                disabled={loading}
                className="btn-secondary py-3 px-6"
              >
                Skip for now
              </button>
            </div>
            {error && <p className="mt-4 text-red-600 text-sm" role="alert">{error}</p>}
          </div>
        </div>
      </div>
    )
  }

  // step === 'setup'
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="py-4 px-6 border-b border-gray-200 bg-white">
        <Link to="/" className="inline-block">
          <Logo height={40} />
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <h1 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-accent-600 shrink-0" />
            Set up two-factor authentication
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            Scan this QR code with your authenticator app (e.g. Google Authenticator), then enter the 6-digit code to confirm.
          </p>
          {twoFASetup && (
            <>
              <div className="flex items-start gap-4 flex-wrap mb-6">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(twoFASetup.otpauthUrl)}`}
                  alt="QR code for authenticator"
                  width={200}
                  height={200}
                  className="border border-gray-200 rounded"
                />
                <div className="text-sm text-gray-600 flex-1 min-w-0">
                  <p className="font-medium text-gray-700 mb-1">Or enter this key manually:</p>
                  <code className="block break-all bg-gray-100 px-2 py-1 rounded text-xs">{twoFASetup.secret}</code>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ''))}
                  className="px-3 py-2 border border-gray-300 rounded-lg w-28 text-center tracking-widest"
                />
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={loading || confirmCode.length !== 6}
                  className="btn-primary"
                >
                  {loading ? 'Verifying…' : 'Confirm and enable'}
                </button>
                <button
                  type="button"
                  onClick={() => { setTwoFASetup(null); setConfirmCode(''); setError(''); setStep('prompt') }}
                  className="text-gray-600 hover:text-gray-800 text-sm"
                >
                  Back
                </button>
              </div>
            </>
          )}
          {error && <p className="mt-3 text-red-600 text-sm" role="alert">{error}</p>}
          {success && <p className="mt-3 text-green-600 text-sm" role="status">{success}</p>}
        </div>
      </div>
    </div>
  )
}
