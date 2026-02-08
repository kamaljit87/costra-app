import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'

const COOKIE_CONSENT_KEY = 'costra_cookie_consent'

interface ConsentState {
  essential: boolean
  analytics: boolean
  consentedAt: string
}

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [analyticsConsent, setAnalyticsConsent] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!consent) {
      // Show banner after a short delay for better UX
      const timer = setTimeout(() => setIsVisible(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const saveConsent = (analytics: boolean) => {
    const consent: ConsentState = {
      essential: true, // Always required
      analytics,
      consentedAt: new Date().toISOString(),
    }
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent))
    setIsVisible(false)

    // Dispatch custom event so other parts of the app can react
    window.dispatchEvent(new CustomEvent('cookieConsentChanged', { detail: consent }))
  }

  const handleAcceptAll = () => {
    saveConsent(true)
  }

  const handleAcceptEssential = () => {
    saveConsent(false)
  }

  const handleSavePreferences = () => {
    saveConsent(analyticsConsent)
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 sm:p-6">
      <div className="max-w-2xl mx-auto bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-surface-200 overflow-hidden">
        {/* Main Banner */}
        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">Cookie Preferences</h3>
            <button
              onClick={handleAcceptEssential}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            We use essential storage (localStorage) for authentication, which is required for the service to work.
            We also use analytics tools (Sentry) for error monitoring, which require your consent.
            Read our{' '}
            <Link to="/privacy" className="text-accent-700 hover:underline font-medium">
              Privacy Policy
            </Link>{' '}
            for more details.
          </p>

          {/* Details Section */}
          {showDetails && (
            <div className="mb-4 space-y-3 bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Essential (Required)</p>
                  <p className="text-xs text-gray-500">Authentication tokens, user preferences</p>
                </div>
                <div className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                  Always On
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Analytics & Error Monitoring</p>
                  <p className="text-xs text-gray-500">Sentry error tracking for service stability</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={analyticsConsent}
                    onChange={(e) => setAnalyticsConsent(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-600"></div>
                </label>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              onClick={handleAcceptAll}
              className="btn-primary py-2 px-4 text-sm font-medium flex-1 sm:flex-none"
            >
              Accept All
            </button>
            <button
              onClick={handleAcceptEssential}
              className="btn-secondary py-2 px-4 text-sm font-medium flex-1 sm:flex-none"
            >
              Essential Only
            </button>
            {!showDetails ? (
              <button
                onClick={() => setShowDetails(true)}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium px-4 py-2 transition-colors"
              >
                Customize
              </button>
            ) : (
              <button
                onClick={handleSavePreferences}
                className="text-sm text-accent-700 hover:text-accent-600 font-medium px-4 py-2 transition-colors"
              >
                Save Preferences
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Helper to check if analytics consent was given.
 * Use this before initializing Sentry or other analytics tools.
 */
export function hasAnalyticsConsent(): boolean {
  try {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!consent) return false
    const parsed: ConsentState = JSON.parse(consent)
    return parsed.analytics === true
  } catch {
    return false
  }
}
