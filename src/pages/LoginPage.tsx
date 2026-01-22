import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import GoogleSignInButton from '../components/GoogleSignInButton'
import Logo from '../components/Logo'
import { LogIn, Mail, Lock, Eye, EyeOff, Cloud, Zap, TrendingUp, BarChart3, Shield, Brain, DollarSign, CheckCircle2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
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
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Left Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-16 lg:px-16">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-12">
            <Logo height={64} />
          </div>

          {/* Title */}
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-[#0F172A] mb-3">Log in to your Account</h1>
            <p className="text-gray-600 text-base">Welcome back! Select method to log in:</p>
          </div>

          {/* Social Login Buttons */}
          <div className="mb-8">
            <GoogleSignInButton mode="signin" />
          </div>

          {/* Divider */}
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E2E8F0]"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#F8FAFC] text-gray-500">or continue with email</span>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]/20 focus:border-transparent text-[#0F172A] placeholder-gray-400 bg-white shadow-sm"
                  placeholder="you@company.com"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3.5 border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]/20 focus:border-transparent text-[#0F172A] placeholder-gray-400 bg-white shadow-sm"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-[#1F3A5F] border-[#E2E8F0] rounded focus:ring-[#1F3A5F]/20"
                />
                <span className="ml-2 text-sm text-gray-700">Remember me</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-[#1F3A5F] hover:text-[#243b53] font-medium"
              >
                Forgot Password?
              </Link>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mt-2">
                {error}
              </div>
            )}

            {/* Login Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary py-3.5 px-4 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  <span>Log in</span>
                </>
              )}
              </button>
            </div>
          </form>

          {/* Sign Up Link */}
          <p className="mt-8 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/signup" className="text-[#1F3A5F] hover:text-[#243b53] font-medium">
              Create an account
            </Link>
          </p>
        </div>
      </div>

      {/* Right Panel - Feature Showcase */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-[#1F3A5F] via-[#2A4A6F] to-[#243b53] items-center justify-center px-20 py-24 relative overflow-hidden">
        {/* Animated Gradient Orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-white/3 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 w-full max-w-2xl">
          {/* Main Heading */}
          <div className="mb-20">
            <h2 className="text-5xl font-bold text-white mb-6 leading-tight">
              Connect with every<br />cloud provider
            </h2>
            <p className="text-lg text-white/70 leading-relaxed">
              Everything you need in an easily customizable dashboard
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-2 gap-5 mb-16">
            {[
              { icon: Cloud, text: 'Multi-cloud visibility', color: 'bg-blue-500/20' },
              { icon: BarChart3, text: 'Advanced analytics', color: 'bg-purple-500/20' },
              { icon: Brain, text: 'AI insights', color: 'bg-indigo-500/20' },
              { icon: DollarSign, text: 'Global currencies', color: 'bg-green-500/20' }
            ].map((feature, index) => (
              <div key={index} className="group">
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                  <div className={`w-12 h-12 ${feature.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <p className="text-sm font-medium text-white/90 group-hover:text-white transition-colors leading-snug">
                    {feature.text}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Dashboard Preview Card */}
          <div className="bg-white/8 backdrop-blur-xl rounded-2xl p-10 shadow-2xl border border-white/10 mb-12">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
              </div>
              <div className="text-xs text-white/40 font-mono">dashboard.costra.com</div>
            </div>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-white/15 flex-shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className={`h-2.5 bg-white/20 rounded ${i % 2 === 0 ? 'w-full' : 'w-4/5'}`}></div>
                    {i === 1 && <div className="h-2 bg-white/10 rounded w-3/5"></div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex items-center justify-center space-x-10 text-center">
            <div>
              <div className="text-2xl font-bold text-white mb-2">7+</div>
              <div className="text-xs text-white/50">Cloud Providers</div>
            </div>
            <div className="w-px h-10 bg-white/20"></div>
            <div>
              <div className="text-2xl font-bold text-white mb-2">100%</div>
              <div className="text-xs text-white/50">Secure</div>
            </div>
            <div className="w-px h-10 bg-white/20"></div>
            <div>
              <div className="text-2xl font-bold text-white mb-2">24/7</div>
              <div className="text-xs text-white/50">Monitoring</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
