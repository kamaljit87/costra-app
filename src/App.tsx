import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { CurrencyProvider } from './contexts/CurrencyContext'
import { FilterProvider } from './contexts/FilterContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { PublicConfigProvider, usePublicConfig } from './contexts/PublicConfigContext'
import { NotificationProvider } from './contexts/NotificationContext'
import CookieConsent from './components/CookieConsent'
import ErrorBoundary from './components/ErrorBoundary'

import LandingPage from './pages/LandingPage'

const NotFound = lazy(() => import('./components/ui/ghost-404-page').then(m => ({ default: m.NotFound })))

// Lazy-load all pages except landing (first paint)
const Dashboard = lazy(() => import('./pages/Dashboard'))
const LoginTravelPage = lazy(() => import('./pages/LoginTravelPage'))
const SignupTravelPage = lazy(() => import('./pages/SignupTravelPage'))
const WaitlistPage = lazy(() => import('./pages/WaitlistPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const ProviderDetailPage = lazy(() => import('./pages/ProviderDetailPage'))
const BudgetsPage = lazy(() => import('./pages/BudgetsPage'))
const ProductCostView = lazy(() => import('./pages/ProductCostView'))
const TeamCostView = lazy(() => import('./pages/TeamCostView'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const BillingPage = lazy(() => import('./pages/BillingPage'))
const CostComparePage = lazy(() => import('./pages/CostComparePage'))
const RecommendationsPage = lazy(() => import('./pages/RecommendationsPage'))
const DebugPage = lazy(() => import('./pages/DebugPage'))
const AdminTicketsPage = lazy(() => import('./pages/AdminTicketsPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const GoogleCallbackPage = lazy(() => import('./pages/GoogleCallbackPage'))
const Verify2FAPage = lazy(() => import('./pages/Verify2FAPage'))
const Suggest2FAPage = lazy(() => import('./pages/Suggest2FAPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const BlogListPage = lazy(() => import('./pages/BlogListPage'))
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'))
const DocsPage = lazy(() => import('./pages/DocsPage'))
const OrganizationPage = lazy(() => import('./pages/OrganizationPage'))
const AnomaliesPage = lazy(() => import('./pages/AnomaliesPage'))
const PoliciesPage = lazy(() => import('./pages/PoliciesPage'))
const ForecastPage = lazy(() => import('./pages/ForecastPage'))
const KubernetesPage = lazy(() => import('./pages/KubernetesPage'))
const WorkflowsPage = lazy(() => import('./pages/WorkflowsPage'))
const SavingsPlansPage = lazy(() => import('./pages/SavingsPlansPage'))
const AllocationsPage = lazy(() => import('./pages/AllocationsPage'))
const TerraformPage = lazy(() => import('./pages/TerraformPage'))
const SaaSPage = lazy(() => import('./pages/SaaSPage'))
const CustomDashboardPage = lazy(() => import('./pages/CustomDashboardPage'))
const BillAnalyzerPage = lazy(() => import('./pages/BillAnalyzerPage'))
const RightsizingPage = lazy(() => import('./pages/RightsizingPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'))
const ConfirmDeletePage = lazy(() => import('./pages/ConfirmDeletePage'))
const CancelDeletePage = lazy(() => import('./pages/CancelDeletePage'))
const VerifyEmailChangePage = lazy(() => import('./pages/VerifyEmailChangePage'))
const CancelEmailChangePage = lazy(() => import('./pages/CancelEmailChangePage'))

/** True when running on the app subdomain (app.costdoq.com) */
export const isAppDomain = window.location.hostname.startsWith('app.')

/** Base URL for the app subdomain — used for cross-domain links from the marketing site */
export const APP_ORIGIN = isAppDomain
  ? ''
  : `https://app.${window.location.hostname}`

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-gray-600 animate-spin" />
  </div>
)

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { authReady, isAuthenticated } = useAuth()
  // On marketing domain, always redirect to app subdomain
  if (!isAppDomain) {
    window.location.href = `${APP_ORIGIN}${window.location.pathname}${window.location.search}`
    return <PageLoader />
  }
  if (!authReady) return <PageLoader />
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { authReady, isAuthenticated } = useAuth()
  if (!authReady) return <PageLoader />
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

function SignupRoute() {
  const { signupDisabled, configReady } = usePublicConfig()
  if (!configReady) return <PageLoader />
  if (signupDisabled) return <Navigate to="/waitlist" replace />
  return <SignupTravelPage />
}

function WaitlistRoute() {
  const { signupDisabled, configReady } = usePublicConfig()
  if (!configReady) return <PageLoader />
  if (!signupDisabled) return <Navigate to="/signup" replace />
  return <WaitlistPage />
}

/** ErrorBoundary that resets when the route changes */
function RouteErrorBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>
}

/** On the marketing site, redirect auth routes to app subdomain */
function RedirectToApp({ path }: { path: string }) {
  window.location.href = `${APP_ORIGIN}${path}${window.location.search}`
  return <PageLoader />
}

function App() {
  return (
    <AuthProvider>
      <PublicConfigProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <CurrencyProvider>
            <FilterProvider>
              <NotificationProvider>
                <RouteErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Landing — on app subdomain, redirect to dashboard */}
                  <Route path="/" element={isAppDomain ? <Navigate to="/dashboard" replace /> : <LandingPage />} />

                  {/* Auth pages — on marketing domain, redirect to app subdomain */}
                  {isAppDomain ? (
                    <>
                      <Route path="/login" element={<PublicRoute><LoginTravelPage /></PublicRoute>} />
                      <Route path="/signup" element={<PublicRoute><SignupRoute /></PublicRoute>} />
                      <Route path="/waitlist" element={<WaitlistRoute />} />
                      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                      <Route path="/reset-password" element={<ResetPasswordPage />} />
                      <Route path="/verify-email" element={<VerifyEmailPage />} />
                      <Route path="/confirm-delete" element={<ConfirmDeletePage />} />
                      <Route path="/cancel-delete" element={<CancelDeletePage />} />
                      <Route path="/verify-email-change" element={<VerifyEmailChangePage />} />
                      <Route path="/cancel-email-change" element={<CancelEmailChangePage />} />
                      <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
                      <Route path="/auth/verify-2fa" element={<Verify2FAPage />} />
                      <Route path="/auth/suggest-2fa" element={<ProtectedRoute><Suggest2FAPage /></ProtectedRoute>} />
                    </>
                  ) : (
                    <>
                      <Route path="/login" element={<RedirectToApp path="/login" />} />
                      <Route path="/signup" element={<RedirectToApp path="/signup" />} />
                      <Route path="/waitlist" element={<RedirectToApp path="/waitlist" />} />
                      <Route path="/forgot-password" element={<RedirectToApp path="/forgot-password" />} />
                      <Route path="/reset-password" element={<RedirectToApp path="/reset-password" />} />
                      <Route path="/verify-email" element={<RedirectToApp path="/verify-email" />} />
                      <Route path="/confirm-delete" element={<RedirectToApp path="/confirm-delete" />} />
                      <Route path="/cancel-delete" element={<RedirectToApp path="/cancel-delete" />} />
                      <Route path="/verify-email-change" element={<RedirectToApp path="/verify-email-change" />} />
                      <Route path="/cancel-email-change" element={<RedirectToApp path="/cancel-email-change" />} />
                      <Route path="/auth/google/callback" element={<RedirectToApp path="/auth/google/callback" />} />
                      <Route path="/auth/verify-2fa" element={<RedirectToApp path="/auth/verify-2fa" />} />
                    </>
                  )}

                  {/* Public pages — served on both domains */}
                  <Route path="/privacy" element={<PrivacyPolicyPage />} />
                  <Route path="/terms" element={<TermsOfServicePage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/blog" element={<BlogListPage />} />
                  <Route path="/blog/:slug" element={<BlogPostPage />} />

                  {/* Protected app pages */}
                  <Route path="/docs" element={<ProtectedRoute><DocsPage /></ProtectedRoute>} />
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                  <Route path="/settings/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                  <Route path="/provider/:providerId" element={<ProtectedRoute><ProviderDetailPage /></ProtectedRoute>} />
                  <Route path="/budgets" element={<ProtectedRoute><BudgetsPage /></ProtectedRoute>} />
                  <Route path="/products" element={<ProtectedRoute><ProductCostView /></ProtectedRoute>} />
                  <Route path="/teams" element={<ProtectedRoute><TeamCostView /></ProtectedRoute>} />
                  <Route path="/compare" element={<ProtectedRoute><CostComparePage /></ProtectedRoute>} />
                  <Route path="/recommendations" element={<ProtectedRoute><RecommendationsPage /></ProtectedRoute>} />
                  <Route path="/rightsizing" element={<ProtectedRoute><RightsizingPage /></ProtectedRoute>} />
                  <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
                  <Route path="/organization" element={<ProtectedRoute><OrganizationPage /></ProtectedRoute>} />
                  <Route path="/anomalies" element={<ProtectedRoute><AnomaliesPage /></ProtectedRoute>} />
                  <Route path="/policies" element={<ProtectedRoute><PoliciesPage /></ProtectedRoute>} />
                  <Route path="/forecasts" element={<ProtectedRoute><ForecastPage /></ProtectedRoute>} />
                  <Route path="/kubernetes" element={<ProtectedRoute><KubernetesPage /></ProtectedRoute>} />
                  <Route path="/workflows" element={<ProtectedRoute><WorkflowsPage /></ProtectedRoute>} />
                  <Route path="/savings-plans" element={<ProtectedRoute><SavingsPlansPage /></ProtectedRoute>} />
                  <Route path="/allocations" element={<ProtectedRoute><AllocationsPage /></ProtectedRoute>} />
                  <Route path="/terraform" element={<ProtectedRoute><TerraformPage /></ProtectedRoute>} />
                  <Route path="/saas" element={<ProtectedRoute><SaaSPage /></ProtectedRoute>} />
                  <Route path="/custom-dashboard" element={<ProtectedRoute><CustomDashboardPage /></ProtectedRoute>} />
                  <Route path="/custom-dashboard/:id" element={<ProtectedRoute><CustomDashboardPage /></ProtectedRoute>} />
                  <Route path="/bill-analyzer" element={<ProtectedRoute><BillAnalyzerPage /></ProtectedRoute>} />
                  <Route path="/debug" element={<ProtectedRoute><DebugPage /></ProtectedRoute>} />
                  <Route path="/admin/tickets" element={<ProtectedRoute><AdminTicketsPage /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
                </RouteErrorBoundary>
              <CookieConsent />
            </NotificationProvider>
          </FilterProvider>
        </CurrencyProvider>
      </Router>
      </PublicConfigProvider>
    </AuthProvider>
  )
}

export default App
