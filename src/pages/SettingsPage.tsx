import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import CurrencySelector from '../components/CurrencySelector'
import CloudProviderManager from '../components/CloudProviderManager'
import { authAPI } from '../services/api'
import { Settings, Globe, Cloud, Shield, ShieldCheck } from 'lucide-react'

type Tab = 'general' | 'providers' | 'security'

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam === 'providers' ? 'providers' : tabParam === 'security' ? 'security' : 'general'
  )
  const [twoFAEnabled, setTwoFAEnabled] = useState<boolean | null>(null)
  const [twoFALoading, setTwoFALoading] = useState(false)
  const [twoFASetup, setTwoFASetup] = useState<{ secret: string; otpauthUrl: string } | null>(null)
  const [twoFAConfirmCode, setTwoFAConfirmCode] = useState('')
  const [twoFADisableCode, setTwoFADisableCode] = useState('')
  const [twoFAError, setTwoFAError] = useState('')
  const [twoFASuccess, setTwoFASuccess] = useState('')

  useEffect(() => {
    if (tabParam === 'providers') setActiveTab('providers')
    else if (tabParam === 'security') setActiveTab('security')
    else setActiveTab('general')
  }, [tabParam])

  useEffect(() => {
    if (activeTab !== 'security') return
    let cancelled = false
    authAPI.get2FAStatus().then((res) => {
      if (!cancelled) setTwoFAEnabled(!!res.enabled)
    }).catch(() => { if (!cancelled) setTwoFAEnabled(false) })
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
            onClick={() => { setActiveTab('general'); setSearchParams({}) }}
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
            onClick={() => { setActiveTab('providers'); setSearchParams({ tab: 'providers' }) }}
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
            onClick={() => { setActiveTab('security'); setSearchParams({ tab: 'security' }) }}
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

        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-accent-700 shrink-0" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Two-factor authentication
                </h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Add an extra layer of security by requiring a code from your authenticator app when signing in.
              </p>
              {twoFAEnabled === null && (
                <p className="text-gray-500 text-sm">Loading…</p>
              )}
              {twoFAEnabled === false && !twoFASetup && (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      setTwoFAError('')
                      setTwoFALoading(true)
                      try {
                        const res = await authAPI.setup2FA()
                        setTwoFASetup({ secret: res.secret, otpauthUrl: res.otpauthUrl })
                        setTwoFAConfirmCode('')
                      } catch (e) {
                        setTwoFAError(e instanceof Error ? e.message : 'Failed to start setup')
                      } finally {
                        setTwoFALoading(false)
                      }
                    }}
                    disabled={twoFALoading}
                    className="btn-primary"
                  >
                    {twoFALoading ? 'Starting…' : 'Enable two-factor authentication'}
                  </button>
                </>
              )}
              {twoFASetup && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-700">Scan this QR code with your authenticator app (e.g. Google Authenticator), then enter the 6-digit code below to confirm.</p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(twoFASetup.otpauthUrl)}`}
                      alt="QR code for authenticator"
                      width={200}
                      height={200}
                      className="border border-gray-200 rounded"
                    />
                    <div className="text-sm text-gray-600">
                      <p className="font-medium text-gray-700 mb-1">Or enter this key manually:</p>
                      <code className="block break-all bg-gray-100 px-2 py-1 rounded text-xs">{twoFASetup.secret}</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={twoFAConfirmCode}
                      onChange={(e) => setTwoFAConfirmCode(e.target.value.replace(/\D/g, ''))}
                      className="px-3 py-2 border border-gray-300 rounded-lg w-28 text-center tracking-widest"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!twoFAConfirmCode || twoFAConfirmCode.length !== 6) {
                          setTwoFAError('Enter the 6-digit code from your app')
                          return
                        }
                        setTwoFAError('')
                        setTwoFALoading(true)
                        try {
                          await authAPI.confirm2FA(twoFAConfirmCode)
                          setTwoFASetup(null)
                          setTwoFAEnabled(true)
                          setTwoFASuccess('Two-factor authentication is now enabled.')
                        } catch (e) {
                          setTwoFAError(e instanceof Error ? e.message : 'Invalid code. Try again.')
                        } finally {
                          setTwoFALoading(false)
                        }
                      }}
                      disabled={twoFALoading}
                      className="btn-primary"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTwoFASetup(null); setTwoFAConfirmCode(''); setTwoFAError('') }}
                      className="text-gray-600 hover:text-gray-800 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {twoFAEnabled === true && !twoFASetup && (
                <div className="space-y-4">
                  <p className="flex items-center gap-2 text-green-700">
                    <ShieldCheck className="h-5 w-5 shrink-0" />
                    <span>Two-factor authentication is enabled.</span>
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Enter code to disable"
                      value={twoFADisableCode}
                      onChange={(e) => setTwoFADisableCode(e.target.value.replace(/\D/g, ''))}
                      className="px-3 py-2 border border-gray-300 rounded-lg w-40 text-center tracking-widest"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!twoFADisableCode || twoFADisableCode.length !== 6) {
                          setTwoFAError('Enter the 6-digit code from your app to disable')
                          return
                        }
                        setTwoFAError('')
                        setTwoFALoading(true)
                        try {
                          await authAPI.disable2FA(twoFADisableCode)
                          setTwoFAEnabled(false)
                          setTwoFADisableCode('')
                          setTwoFASuccess('Two-factor authentication has been disabled.')
                        } catch (e) {
                          setTwoFAError(e instanceof Error ? e.message : 'Invalid code. Try again.')
                        } finally {
                          setTwoFALoading(false)
                        }
                      }}
                      disabled={twoFALoading}
                      className="btn-secondary border-red-200 text-red-700 hover:bg-red-50"
                    >
                      Disable 2FA
                    </button>
                  </div>
                </div>
              )}
              {twoFAError && <p className="text-red-600 text-sm mt-2" role="alert">{twoFAError}</p>}
              {twoFASuccess && <p className="text-green-600 text-sm mt-2" role="status">{twoFASuccess}</p>}
            </div>
          </div>
        )}

        {activeTab === 'providers' && (
          <div>
            <CloudProviderManager />
          </div>
        )}

      </div>
      </div>
    </Layout>
  )
}
