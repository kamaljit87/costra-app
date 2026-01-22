import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import GoogleSignInButton from '../components/GoogleSignInButton'
import Logo from '../components/Logo'
import { UserPlus, Mail, Lock, Eye, EyeOff, User, Cloud, BarChart3, Brain, DollarSign } from 'lucide-react'

const features = [
  { icon: Cloud, text: 'Multi-cloud visibility', description: 'Connect AWS, Azure, GCP, and more in one unified view', color: 'bg-blue-500/20' },
  { icon: BarChart3, text: 'Advanced analytics', description: 'Deep insights into your cloud spending patterns', color: 'bg-purple-500/20' },
  { icon: Brain, text: 'AI-powered insights', description: 'Get intelligent recommendations to optimize costs', color: 'bg-indigo-500/20' },
  { icon: DollarSign, text: 'Global currencies', description: 'View costs in your preferred currency with real-time rates', color: 'bg-green-500/20' }
]

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentFeature, setCurrentFeature] = useState(0)
  const { signup } = useAuth()
  const navigate = useNavigate()

  // Auto-rotate features
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    setIsLoading(true)

    try {
      const success = await signup(name, email, password)
      if (success) {
        navigate('/dashboard')
      } else {
        setError('Signup failed. Please try again.')
      }
    } catch (err: any) {
      console.error('Signup error:', err)
      let errorMessage = 'An error occurred. Please try again.'
      if (err.message) {
        errorMessage = err.message
      } else if (err.error) {
        errorMessage = err.error
      } else if (typeof err === 'string') {
        errorMessage = err
      }
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Left Panel - Signup Form */}
      <div className="flex-1 flex items-start justify-center px-6 pt-12 pb-8 lg:px-16 lg:pt-16 lg:pb-12 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-6">
            <Logo height={48} />
          </div>

          {/* Title Section */}
          <div className="mb-5">
            <h1 className="text-3xl font-bold text-[#0F172A] mb-2">Create your account</h1>
            <p className="text-gray-600 text-base">Start managing your cloud costs today</p>
          </div>

          {/* Social Login */}
          <div className="mb-6">
            <GoogleSignInButton mode="signup" />
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E2E8F0]"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#F8FAFC] text-gray-500">or continue with email</span>
            </div>
          </div>

          {/* Signup Form */}
          <form onSubmit={handleSignup} className="space-y-5">
            {/* Name Input */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-[#0F172A] mb-2">
                Full name
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]/20 focus:border-[#1F3A5F]/30 text-[#0F172A] placeholder-gray-400 bg-white shadow-sm transition-all"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#0F172A] mb-2">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]/20 focus:border-[#1F3A5F]/30 text-[#0F172A] placeholder-gray-400 bg-white shadow-sm transition-all"
                  placeholder="you@company.com"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#0F172A] mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3.5 border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]/20 focus:border-[#1F3A5F]/30 text-[#0F172A] placeholder-gray-400 bg-white shadow-sm transition-all"
                  placeholder="Create a password"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#1F3A5F] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Must be at least 8 characters</p>
            </div>

            {/* Confirm Password Input */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#0F172A] mb-2">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3.5 border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]/20 focus:border-[#1F3A5F]/30 text-[#0F172A] placeholder-gray-400 bg-white shadow-sm transition-all"
                  placeholder="Confirm your password"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#1F3A5F] transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* Signup Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-3.5 px-4 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5" />
                  <span>Create account</span>
                </>
              )}
            </button>
          </form>

          {/* Sign In Link */}
          <p className="mt-8 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-[#1F3A5F] hover:text-[#243b53] font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right Panel - Feature Showcase */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-[#1F3A5F] via-[#2A4A6F] to-[#243b53] items-center justify-center px-20 py-24 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-white/3 rounded-full blur-3xl"></div>
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
                    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 h-full flex flex-col items-center justify-center text-center">
                      <div className={`w-14 h-14 ${feature.color} rounded-lg flex items-center justify-center mb-4`}>
                        <Icon className="h-7 w-7 text-white" />
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
                      ? 'w-8 h-2 bg-white'
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
