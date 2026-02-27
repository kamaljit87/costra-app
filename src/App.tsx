import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { CurrencyProvider } from './contexts/CurrencyContext'
import { FilterProvider } from './contexts/FilterContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { PublicConfigProvider, usePublicConfig } from './contexts/PublicConfigContext'
import { NotificationProvider } from './contexts/NotificationContext'
import CookieConsent from './components/CookieConsent'

const LandingPage = lazy(() => import('./pages/LandingPage'))
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
const ChatBubbleDemoPage = lazy(() => import('./pages/ChatBubbleDemoPage'))
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

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-800" />
  </div>
)

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { authReady, isAuthenticated } = useAuth()
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-800" />
      </div>
    )
  }
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { authReady, isAuthenticated } = useAuth()
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-800" />
      </div>
    )
  }
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

function SignupRoute() {
  const { signupDisabled, configReady } = usePublicConfig()
  if (!configReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-800" />
      </div>
    )
  }
  if (signupDisabled) {
    return <Navigate to="/login" replace state={{ signupDisabled: true }} />
  }
  return <SignupTravelPage />
}

function App() {
  return (
    <AuthProvider>
      <PublicConfigProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <CurrencyProvider>
            <FilterProvider>
              <NotificationProvider>
                <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<PublicRoute><LoginTravelPage /></PublicRoute>} />
                  <Route path="/signup" element={<PublicRoute><SignupRoute /></PublicRoute>} />
                  <Route path="/waitlist" element={<WaitlistPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
                <Route path="/auth/verify-2fa" element={<Verify2FAPage />} />
                <Route path="/auth/suggest-2fa" element={<ProtectedRoute><Suggest2FAPage /></ProtectedRoute>} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/terms" element={<TermsOfServicePage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/blog" element={<BlogListPage />} />
                <Route path="/blog/:slug" element={<BlogPostPage />} />
                <Route path="/docs" element={<DocsPage />} />
                <Route
                  path="/chat-demo"
                  element={
                    <ProtectedRoute>
                      <ChatBubbleDemoPage />
                    </ProtectedRoute>
                  }
                />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/billing"
              element={
                <ProtectedRoute>
                  <BillingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/provider/:providerId"
              element={
                <ProtectedRoute>
                  <ProviderDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/budgets"
              element={
                <ProtectedRoute>
                  <BudgetsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products"
              element={
                <ProtectedRoute>
                  <ProductCostView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teams"
              element={
                <ProtectedRoute>
                  <TeamCostView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/compare"
              element={
                <ProtectedRoute>
                  <CostComparePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recommendations"
              element={
                <ProtectedRoute>
                  <RecommendationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/organization"
              element={
                <ProtectedRoute>
                  <OrganizationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/anomalies"
              element={
                <ProtectedRoute>
                  <AnomaliesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/policies"
              element={
                <ProtectedRoute>
                  <PoliciesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/forecasts"
              element={
                <ProtectedRoute>
                  <ForecastPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/kubernetes"
              element={
                <ProtectedRoute>
                  <KubernetesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/debug"
              element={
                <ProtectedRoute>
                  <DebugPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tickets"
              element={
                <ProtectedRoute>
                  <AdminTicketsPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
              </Routes>
                </Suspense>
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

