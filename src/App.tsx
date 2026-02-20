import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { CurrencyProvider } from './contexts/CurrencyContext'
import { FilterProvider } from './contexts/FilterContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { PublicConfigProvider, usePublicConfig } from './contexts/PublicConfigContext'
import { NotificationProvider } from './contexts/NotificationContext'
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import LoginTravelPage from './pages/LoginTravelPage'
import SignupTravelPage from './pages/SignupTravelPage'
import SettingsPage from './pages/SettingsPage'
import ProfilePage from './pages/ProfilePage'
import ProviderDetailPage from './pages/ProviderDetailPage'
import BudgetsPage from './pages/BudgetsPage'
import ProductCostView from './pages/ProductCostView'
import TeamCostView from './pages/TeamCostView'
import ReportsPage from './pages/ReportsPage'
import BillingPage from './pages/BillingPage'
import CostComparePage from './pages/CostComparePage'
import RecommendationsPage from './pages/RecommendationsPage'
import DebugPage from './pages/DebugPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import TermsOfServicePage from './pages/TermsOfServicePage'
import ContactPage from './pages/ContactPage'
import ChatBubbleDemoPage from './pages/ChatBubbleDemoPage'
import GoogleCallbackPage from './pages/GoogleCallbackPage'
import Verify2FAPage from './pages/Verify2FAPage'
import Suggest2FAPage from './pages/Suggest2FAPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import BlogListPage from './pages/BlogListPage'
import BlogPostPage from './pages/BlogPostPage'
import CookieConsent from './components/CookieConsent'
import { NotFound } from './components/ui/ghost-404-page'

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
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<PublicRoute><LoginTravelPage /></PublicRoute>} />
                  <Route path="/signup" element={<PublicRoute><SignupRoute /></PublicRoute>} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
                <Route path="/auth/verify-2fa" element={<Verify2FAPage />} />
                <Route path="/auth/suggest-2fa" element={<ProtectedRoute><Suggest2FAPage /></ProtectedRoute>} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/terms" element={<TermsOfServicePage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/blog" element={<BlogListPage />} />
                <Route path="/blog/:slug" element={<BlogPostPage />} />
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
              path="/debug"
              element={
                <ProtectedRoute>
                  <DebugPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
              </Routes>
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

