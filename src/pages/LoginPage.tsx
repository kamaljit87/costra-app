import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePublicConfig } from '../contexts/PublicConfigContext'
import GoogleSignInButton from '../components/GoogleSignInButton'
import Logo from '../components/Logo'
import { LogIn, Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const { signupDisabled } = usePublicConfig()
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const success = await login(email, password)
      if (success) {
        navigate('/dashboard')
      } else {
        setError('Invalid credentials. Please try again.')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col">
      {/* Top bar with logo */}
      <div className="py-6 px-8 border-b border-surface-300 bg-white">
        <Link to="/">
          <Logo height={48} />
        </Link>
      </div>

      {/* Centered content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-xl border border-surface-300 shadow-card p-8">
          {/* Title Section */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
            <p className="text-gray-500">Sign in to continue to your dashboard</p>
          </div>

          {/* Social Login */}
          <div className="mb-6">
            <GoogleSignInButton mode="signin" />
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">or continue with email</span>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-2">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 text-gray-900 placeholder-gray-400 bg-white transition-colors"
                  placeholder="you@company.com"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-900 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 text-gray-900 placeholder-gray-400 bg-white transition-colors"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-accent-700 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-accent-600 border-surface-300 rounded focus:ring-accent-500/20 cursor-pointer"
                />
                <span className="ml-2.5 text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Remember me</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-accent-600 hover:text-accent-500 font-medium transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-3 px-4 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  <span>Sign in</span>
                </>
              )}
            </button>
          </form>

          {/* Sign Up / Waitlist Link */}
          <p className="mt-8 text-center text-sm text-gray-600">
            {signupDisabled ? (
              <>
                Want access?{' '}
                <Link to="/waitlist" className="text-accent-600 hover:text-accent-500 font-semibold transition-colors">
                  Join the waitlist
                </Link>
              </>
            ) : (
              <>
                Don't have an account?{' '}
                <Link to="/signup" className="text-accent-600 hover:text-accent-500 font-semibold transition-colors">
                  Sign up for free
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
