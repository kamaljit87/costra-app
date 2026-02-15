import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import CurrencySelector from '../components/CurrencySelector'
import CloudProviderManager from '../components/CloudProviderManager'
import { authAPI } from '../services/api'
import { Settings, Globe, Cloud, Shield } from 'lucide-react'

type Tab = 'general' | 'providers' | 'security'

export default function SettingsPage() {
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam === 'providers' ? 'providers' : tabParam === 'security' ? 'security' : 'general'
  )
  const [twoFAEnabled, setTwoFAEnabled] = useState<boolean | null>(null)
  const [twoFALoading, setTwoFALoading] = useState(false)
  const [twoFAError, setTwoFAError] = useState('')

  useEffect(() => {
    if (tabParam === 'providers') setActiveTab('providers')
    else if (tabParam === 'security') setActiveTab('security')
  }, [tabParam])

  useEffect(() => {
    if (activeTab !== 'security') return
    let cancelled = false
    setTwoFAError('')
    authAPI.get2FAStatus()
      .then((r) => { if (!cancelled) setTwoFAEnabled(r.enabled) })
      .catch(() => { if (!cancelled) setTwoFAEnabled(false) })
    return () => { cancelled = true }
  }, [activeTab])

  return (
    <Layout>
      <div className="w-full max-w-[1920px] mx-auto px-6 lg:px-12 xl:px-16 py-10">
        {/* Breadcrumbs */}
        <Breadcrumbs />

        {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">
          Manage your account preferences and cloud provider integrations
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-6 sm:gap-8">
          <button
            onClick={() => setActiveTab('general')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm -mb-px
              ${
                activeTab === 'general'
                  ? 'border-accent-500 text-accent-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span>General</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('providers')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm -mb-px
              ${
                activeTab === 'providers'
                  ? 'border-accent-500 text-accent-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              <span>Cloud Providers</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm -mb-px
              ${
                activeTab === 'security'
                  ? 'border-accent-500 text-accent-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Security</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Currency Settings */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="h-5 w-5 text-accent-700 shrink-0" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Currency Preferences
                </h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Select your preferred currency for displaying cost data. All financial
                information will be converted and displayed in your chosen currency.
              </p>
              <div className="max-w-xs">
                <CurrencySelector />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'providers' && (
          <div>
            <CloudProviderManager />
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
            <TwoFactorSection
              enabled={twoFAEnabled}
              loading={twoFALoading}
              error={twoFAError}
              onLoading={(v) => setTwoFALoading(v)}
              onError={(msg) => setTwoFAError(msg)}
              onEnabledChange={() => setTwoFAEnabled(true)}
              onDisabledChange={() => setTwoFAEnabled(false)}
              onRefetchStatus={async () => {
                setTwoFAError('')
                try {
                  const r = await authAPI.get2FAStatus()
                  setTwoFAEnabled(r.enabled)
                } catch {
                  setTwoFAEnabled(false)
                }
              }}
            />
          </div>
        )}
      </div>
      </div>
    </Layout>
  )
}

function TwoFactorSection({
  enabled,
  loading,
  error,
  onLoading,
  onError,
  onEnabledChange,
  onDisabledChange,
  onRefetchStatus,
}: {
  enabled: boolean | null
  loading: boolean
  error: string
  onLoading: (v: boolean) => void
  onError: (msg: string) => void
  onEnabledChange: () => void
  onDisabledChange: () => void
  onRefetchStatus: () => Promise<void>
}) {
  const [step, setStep] = useState<'idle' | 'setup' | 'confirm' | 'disable'>('idle')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [disablePassword, setDisablePassword] = useState('')
  const [disableCode, setDisableCode] = useState('')

  const startSetup = async () => {
    onError('')
    onLoading(true)
    try {
      const data = await authAPI.setup2FA()
      setQrDataUrl(data.qrDataUrl)
      setSecret(data.secret)
      setStep('setup')
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Failed to start 2FA setup')
    } finally {
      onLoading(false)
    }
  }

  const confirmSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    onError('')
    onLoading(true)
    try {
      await authAPI.confirm2FA(code.trim())
      setStep('idle')
      setCode('')
      setQrDataUrl('')
      setSecret('')
      onEnabledChange()
      await onRefetchStatus()
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Invalid code')
    } finally {
      onLoading(false)
    }
  }

  const doDisable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!disablePassword.trim()) return
    onError('')
    onLoading(true)
    try {
      await authAPI.disable2FA(disablePassword, disableCode.trim() || undefined)
      setStep('idle')
      setDisablePassword('')
      setDisableCode('')
      onDisabledChange()
      await onRefetchStatus()
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Failed to disable 2FA')
    } finally {
      onLoading(false)
    }
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-accent-700 shrink-0" />
        <h2 className="text-lg font-semibold text-gray-900">Two-factor authentication</h2>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Add an extra layer of security by requiring a code from your phone when signing in.
      </p>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {enabled === null && !loading && <p className="text-sm text-gray-500">Loading…</p>}

      {enabled === false && step === 'idle' && (
        <div>
          <button type="button" onClick={startSetup} disabled={loading} className="btn-primary">
            {loading ? 'Starting…' : 'Enable two-factor authentication'}
          </button>
        </div>
      )}

      {step === 'setup' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">Scan this QR code with your authenticator app (e.g. Google Authenticator, Authy):</p>
          {qrDataUrl && <img src={qrDataUrl} alt="QR code" className="w-48 h-48 border border-gray-200 rounded" />}
          <p className="text-sm text-gray-500">Or enter this secret manually: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded break-all">{secret}</code></p>
          <form onSubmit={confirmSetup} className="flex flex-col gap-3 max-w-xs">
            <label className="block text-sm font-medium text-gray-700">Enter the 6-digit code from your app</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="000000"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => { setStep('idle'); setQrDataUrl(''); setSecret(''); setCode('') }} className="px-4 py-2 text-gray-600">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn-primary">Confirm and enable</button>
            </div>
          </form>
        </div>
      )}

      {enabled === true && step === 'idle' && (
        <div>
          <p className="text-sm text-green-700 font-medium mb-3">Two-factor authentication is enabled.</p>
          <button type="button" onClick={() => setStep('disable')} className="btn-secondary">
            Disable two-factor authentication
          </button>
        </div>
      )}

      {step === 'disable' && (
        <form onSubmit={doDisable} className="space-y-4 max-w-sm">
          <p className="text-sm text-gray-600">Enter your password to disable 2FA. You may also enter your current authenticator code for extra security.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current code (optional)</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="000000"
              maxLength={8}
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setStep('idle'); setDisablePassword(''); setDisableCode('') }} className="px-4 py-2 text-gray-600">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">Disable 2FA</button>
          </div>
        </form>
      )}
    </div>
  )
}
