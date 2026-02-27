import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import CurrencySelector from '../components/CurrencySelector'
import CloudProviderManager from '../components/CloudProviderManager'
import { authAPI, emailPreferencesAPI, billingAPI, apiKeysAPI } from '../services/api'
import { Settings, Globe, Cloud, Shield, ShieldCheck, Mail, Sun, Moon, Monitor, Key, Plus, Trash2, Copy, Building2, ChevronRight } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

type Tab = 'general' | 'providers' | 'security' | 'api'

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam === 'providers' ? 'providers' : tabParam === 'security' ? 'security' : tabParam === 'api' ? 'api' : 'general'
  )
  const [twoFAEnabled, setTwoFAEnabled] = useState<boolean | null>(null)
  const [twoFALoading, setTwoFALoading] = useState(false)
  const [twoFASetup, setTwoFASetup] = useState<{ secret: string; otpauthUrl: string } | null>(null)
  const [twoFAConfirmCode, setTwoFAConfirmCode] = useState('')
  const [twoFADisableCode, setTwoFADisableCode] = useState('')
  const [twoFAError, setTwoFAError] = useState('')
  const [twoFASuccess, setTwoFASuccess] = useState('')
  const [emailPrefs, setEmailPrefs] = useState<{
    emailAlertsEnabled?: boolean
    emailAnomalyAlerts?: boolean
    emailBudgetAlerts?: boolean
    emailWeeklySummary?: boolean
  } | null>(null)
  const [emailPrefsSaving, setEmailPrefsSaving] = useState(false)
  const [isPro, setIsPro] = useState<boolean | null>(null)
  const { theme, setTheme } = useTheme()

  const [apiKeys, setApiKeys] = useState<Array<{ id: number; name: string | null; key_prefix: string; created_at: string }>>([])
  const [apiKeysLoading, setApiKeysLoading] = useState(false)
  const [createKeyLoading, setCreateKeyLoading] = useState(false)
  const [newKeyShown, setNewKeyShown] = useState<string | null>(null)

  useEffect(() => {
    if (tabParam === 'providers') setActiveTab('providers')
    else if (tabParam === 'security') setActiveTab('security')
    else if (tabParam === 'api') setActiveTab('api')
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

  useEffect(() => {
    if (activeTab === 'api') {
      setApiKeysLoading(true)
      apiKeysAPI.getList().then(setApiKeys).catch(() => setApiKeys([])).finally(() => setApiKeysLoading(false))
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'general') return
    let cancelled = false
    Promise.all([
      billingAPI.getSubscription().then((r) => (r.subscription?.planType || r.planType) === 'pro'),
      emailPreferencesAPI.getPreferences().then((r) => r.preferences),
    ]).then(([pro, prefs]) => {
      if (!cancelled) {
        setIsPro(pro)
        setEmailPrefs(prefs || null)
      }
    }).catch(() => {
      if (!cancelled) {
        setIsPro(false)
        setEmailPrefs(null)
      }
    })
    return () => { cancelled = true }
  }, [activeTab])

  return (
    <Layout>
      <div className="w-full max-w-[1920px] mx-auto px-6 lg:px-12 xl:px-16 py-10">
        {/* Breadcrumbs */}
        <Breadcrumbs />

        {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Settings</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Manage your account preferences and cloud provider integrations
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6 sm:gap-8">
          <button
            onClick={() => { setActiveTab('general'); setSearchParams({}) }}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm -mb-px transition-colors
              ${
                activeTab === 'general'
                  ? 'border-accent-500 text-accent-700 dark:text-accent-300'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'
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
                  ? 'border-accent-500 text-accent-700 dark:text-accent-300'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'
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
                  ? 'border-accent-500 text-accent-700 dark:text-accent-300'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Security</span>
            </div>
          </button>
          <button
            onClick={() => { setActiveTab('api'); setSearchParams({ tab: 'api' }) }}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm -mb-px
              ${
                activeTab === 'api'
                  ? 'border-accent-500 text-accent-700 dark:text-accent-300'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              <span>API</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Theme */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Sun className="h-5 w-5 text-accent-700 shrink-0 dark:text-accent-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Appearance</h2>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Choose light, dark, or match your system preference.
              </p>
              <div className="flex flex-wrap gap-2">
                {(['light', 'dark', 'system'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTheme(mode)}
                    className={`
                      inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium
                      ${theme === mode
                        ? 'bg-accent-100 border-accent-500 text-accent-700 dark:bg-accent-900/40 dark:border-accent-500 dark:text-accent-300'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-500'
                      }
                    `}
                  >
                    {mode === 'light' && <Sun className="h-4 w-4" />}
                    {mode === 'dark' && <Moon className="h-4 w-4" />}
                    {mode === 'system' && <Monitor className="h-4 w-4" />}
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Currency Settings */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="h-5 w-5 text-accent-700 shrink-0 dark:text-accent-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Currency Preferences
                </h2>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Select your preferred currency for displaying cost data. All financial
                information will be converted and displayed in your chosen currency.
              </p>
              <div className="max-w-xs">
                <CurrencySelector />
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="h-5 w-5 text-accent-700 shrink-0" />
                <h2 className="text-lg font-semibold text-gray-900">Email reports and alerts</h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">Receive cost summaries and alerts by email. Available on Pro.</p>
              {isPro === false && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Upgrade to Pro to enable email reports and alerts.</p>
              )}
              {isPro === true && emailPrefs && (
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={!!emailPrefs.emailAlertsEnabled} disabled={emailPrefsSaving} className="rounded border-gray-300"
                      onChange={async (e) => { const v = e.target.checked; setEmailPrefs((p) => p ? { ...p, emailAlertsEnabled: v } : null); setEmailPrefsSaving(true); try { await emailPreferencesAPI.updatePreferences({ ...emailPrefs, emailAlertsEnabled: v }); } finally { setEmailPrefsSaving(false); } }} />
                    <span className="text-sm text-gray-700">Enable all email alerts</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={!!emailPrefs.emailWeeklySummary} disabled={emailPrefsSaving} className="rounded border-gray-300"
                      onChange={async (e) => { const v = e.target.checked; setEmailPrefs((p) => p ? { ...p, emailWeeklySummary: v } : null); setEmailPrefsSaving(true); try { await emailPreferencesAPI.updatePreferences({ ...emailPrefs, emailWeeklySummary: v }); } finally { setEmailPrefsSaving(false); } }} />
                    <span className="text-sm text-gray-700">Weekly cost summary (Mondays)</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={!!emailPrefs.emailBudgetAlerts} disabled={emailPrefsSaving} className="rounded border-gray-300"
                      onChange={async (e) => { const v = e.target.checked; setEmailPrefs((p) => p ? { ...p, emailBudgetAlerts: v } : null); setEmailPrefsSaving(true); try { await emailPreferencesAPI.updatePreferences({ ...emailPrefs, emailBudgetAlerts: v }); } finally { setEmailPrefsSaving(false); } }} />
                    <span className="text-sm text-gray-700">Budget alerts</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={!!emailPrefs.emailAnomalyAlerts} disabled={emailPrefsSaving} className="rounded border-gray-300"
                      onChange={async (e) => { const v = e.target.checked; setEmailPrefs((p) => p ? { ...p, emailAnomalyAlerts: v } : null); setEmailPrefsSaving(true); try { await emailPreferencesAPI.updatePreferences({ ...emailPrefs, emailAnomalyAlerts: v }); } finally { setEmailPrefsSaving(false); } }} />
                    <span className="text-sm text-gray-700">Anomaly alerts</span>
                  </label>
                </div>
              )}
              {isPro === true && emailPrefs === null && <p className="text-gray-500 text-sm">Loading…</p>}
            </div>

            {/* Organization */}
            <Link to="/organization" className="card block hover:border-accent-300 transition-colors group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-accent-700 shrink-0 dark:text-accent-400" />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Organization</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Manage your organization, members, and roles</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-accent-500 transition-colors" />
              </div>
            </Link>
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

        {activeTab === 'api' && (
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Key className="h-5 w-5 text-accent-700 dark:text-accent-400 shrink-0" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">API keys</h2>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Create API keys to access cost and insights data from scripts or BI tools. Use <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Authorization: Bearer &lt;key&gt;</code>. Keys are read-only and cannot manage account or create new keys.
              </p>
              {newKeyShown && (
                <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">Copy your key now — it won’t be shown again.</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono break-all">{newKeyShown}</code>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(newKeyShown); setNewKeyShown(null) }}
                      className="btn-secondary shrink-0"
                    >
                      <Copy className="h-4 w-4" /> Copy &amp; dismiss
                    </button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={async () => {
                    setCreateKeyLoading(true)
                    try {
                      const res = await apiKeysAPI.create()
                      setApiKeys((prev) => [{ id: res.id, name: res.name, key_prefix: res.key_prefix, created_at: res.created_at }, ...prev])
                      if (res.key) setNewKeyShown(res.key)
                    } catch (_) { /* ignore */ }
                    finally { setCreateKeyLoading(false) }
                  }}
                  disabled={createKeyLoading}
                  className="btn-primary"
                >
                  {createKeyLoading ? 'Creating…' : <><Plus className="h-4 w-4" /> Create key</>}
                </button>
              </div>
              {apiKeysLoading ? (
                <p className="text-sm text-gray-500 dark:text-gray-300">Loading…</p>
              ) : apiKeys.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-300">No API keys yet. Create one to get started.</p>
              ) : (
                <ul className="space-y-2">
                  {apiKeys.map((k) => (
                    <li key={k.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <div>
                        <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{k.key_prefix}</span>
                        {k.name && <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">{k.name}</span>}
                        <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{new Date(k.created_at).toLocaleDateString()}</span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => { try { await apiKeysAPI.delete(k.id); setApiKeys((prev) => prev.filter((x) => x.id !== k.id)) } catch (_) { /* ignore */ } }}
                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                        aria-label="Revoke key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

      </div>
      </div>
    </Layout>
  )
}
