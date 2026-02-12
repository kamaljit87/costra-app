import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { CurrencyProvider } from './contexts/CurrencyContext'
import { FilterProvider } from './contexts/FilterContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
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
import CookieConsent from './components/CookieConsent'
import { NotFound } from './components/ui/ghost-404-page'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <CurrencyProvider>
          <FilterProvider>
            <NotificationProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginTravelPage />} />
            <Route path="/signup" element={<SignupTravelPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsOfServicePage />} />
            <Route path="/contact" element={<ContactPage />} />
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
      </AuthProvider>
    </Router>
  )
}

export default App

