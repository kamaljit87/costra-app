import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import GoogleSignInButton from '../components/GoogleSignInButton'
import Logo from '../components/Logo'
import { LogIn, Mail, Lock, Eye, EyeOff, Cloud, BarChart3, Brain, DollarSign } from 'lucide-react'

const features = [
  { icon: Cloud, text: 'Multi-cloud visibility', description: 'Connect AWS, Azure, GCP, and more in one unified view', color: 'bg-accent-500/20' },
  { icon: BarChart3, text: 'Advanced analytics', description: 'Deep insights into your cloud spending patterns', color: 'bg-accent-400/20' },
  { icon: Brain, text: 'AI-powered insights', description: 'Get intelligent recommendations to optimize costs', color: 'bg-accent-600/20' },
  { icon: DollarSign, text: 'Global currencies', description: 'View costs in your preferred currency with real-time rates', color: 'bg-accent-500/20' }
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentFeature, setCurrentFeature] = useState(0)
  const { login } = useAuth()
  const navigate = useNavigate()

  // Auto-rotate features
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

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
    <div className="min-h-screen bg-surface-50 flex">
      {/* Left Panel - Login Form */}
      <div className="flex-1 flex items-start justify-center px-6 pt-12 pb-8 lg:px-16 lg:pt-16 lg:pb-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-6">
            <Logo height={48} />
          </div>

          {/* Title Section */}
          <div className="mb-5">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h1>
            <p className="text-gray-600 text-base">Sign in to continue to your dashboard</p>
          </div>

          {/* Social Login */}
          <div className="mb-6">
            <GoogleSignInButton mode="signin" />
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-surface-50 text-gray-500">or continue with email</span>
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
                  className="w-full pl-12 pr-4 py-3.5 border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 text-gray-900 placeholder-gray-400 bg-white shadow-sm transition-all"
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
                  className="w-full pl-12 pr-12 py-3.5 border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 text-gray-900 placeholder-gray-400 bg-white shadow-sm transition-all"
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
                  className="w-4 h-4 text-accent-600 border-surface-200 rounded focus:ring-accent-500/20 cursor-pointer"
                />
                <span className="ml-2.5 text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Remember me</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-accent-700 hover:text-accent-600 font-medium transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-3.5 px-4 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
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

          {/* Sign Up Link */}
          <p className="mt-8 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/signup" className="text-accent-700 hover:text-accent-600 font-semibold transition-colors">
              Sign up for free
            </Link>
          </p>
        </div>
      </div>

      {/* Right Panel - Feature Showcase */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary-800 via-primary-900 to-primary-800 items-center justify-center px-20 py-24 relative overflow-hidden">
        {/* Animated Background Orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl animate-float"></div>
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-accent-400/8 rounded-full blur-3xl animate-float-delayed"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-accent-500/5 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 w-full max-w-xl">
          {/* Main Heading */}
          <div className="mb-16">
            <h2 className="text-5xl font-bold text-white mb-4 leading-tight">
              Multi-cloud cost<br />management made simple
            </h2>
            <p className="text-lg text-white/80 leading-relaxed">
              Connect all your cloud providers in one unified dashboard
            </p>
          </div>

          {/* Feature Carousel */}
          <div className="mb-12">
            <div className="relative h-56 overflow-hidden">
              {features.map((feature, index) => {
                const Icon = feature.icon
                const isActive = index === currentFeature
                return (
                  <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-500 ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <div className="bg-white/5 backdrop-blur-md rounded-xl p-6 border border-white/10 h-full flex flex-col items-center justify-center text-center">
                      <div className={`w-14 h-14 ${feature.color} rounded-lg flex items-center justify-center mb-4`}>
                        <Icon className="h-7 w-7 text-accent-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">{feature.text}</h3>
                      <p className="text-sm text-white/70 leading-relaxed max-w-xs">{feature.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Carousel Dots */}
            <div className="flex items-center justify-center space-x-2 mt-6">
              {features.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentFeature(index)}
                  className={`transition-all duration-300 rounded-full ${
                    index === currentFeature
                      ? 'w-8 h-2 bg-accent-400'
                      : 'w-2 h-2 bg-white/30 hover:bg-white/50'
                  }`}
                  aria-label={`Go to feature ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
