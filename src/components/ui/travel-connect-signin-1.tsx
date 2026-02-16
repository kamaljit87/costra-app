import React, { useRef, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, UserPlus, User, Mail, Lock } from 'lucide-react'
import { motion } from 'framer-motion'

const cn = (...classes: string[]) => classes.filter(Boolean).join(' ')

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  variant?: 'default' | 'outline'
  className?: string
}

const Button = ({
  children,
  variant = 'default',
  className = '',
  ...props
}: ButtonProps) => {
  const baseStyles = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'
  const variantStyles = {
    default: 'bg-gradient-to-r from-accent-500 to-accent-600 text-white hover:from-accent-600 hover:to-accent-700',
    outline: 'border border-surface-200 bg-white hover:bg-surface-100 hover:text-gray-900',
  }
  return (
    <button className={`${baseStyles} ${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

const Input = ({ className = '', ...props }: InputProps) => (
  <input
    className={cn(
      'flex h-10 w-full rounded-md border border-surface-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
)

type RoutePoint = { x: number; y: number; delay: number }

const DotMap = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  const routes: { start: RoutePoint; end: RoutePoint; color: string }[] = [
    { start: { x: 100, y: 150, delay: 0 }, end: { x: 200, y: 80, delay: 2 }, color: '#3F4ABF' },
    { start: { x: 200, y: 80, delay: 2 }, end: { x: 260, y: 120, delay: 4 }, color: '#3F4ABF' },
    { start: { x: 50, y: 50, delay: 1 }, end: { x: 150, y: 180, delay: 3 }, color: '#3F4ABF' },
    { start: { x: 280, y: 60, delay: 0.5 }, end: { x: 180, y: 180, delay: 2.5 }, color: '#3F4ABF' },
  ]

  const generateDots = (width: number, height: number) => {
    const dots: { x: number; y: number; radius: number; opacity: number }[] = []
    const gap = 12
    const dotRadius = 1
    for (let x = 0; x < width; x += gap) {
      for (let y = 0; y < height; y += gap) {
        const isInMapShape =
          ((x < width * 0.25 && x > width * 0.05) && (y < height * 0.4 && y > height * 0.1)) ||
          ((x < width * 0.25 && x > width * 0.15) && (y < height * 0.8 && y > height * 0.4)) ||
          ((x < width * 0.45 && x > width * 0.3) && (y < height * 0.35 && y > height * 0.15)) ||
          ((x < width * 0.5 && x > width * 0.35) && (y < height * 0.65 && y > height * 0.35)) ||
          ((x < width * 0.7 && x > width * 0.45) && (y < height * 0.5 && y > height * 0.1)) ||
          ((x < width * 0.8 && x > width * 0.65) && (y < height * 0.8 && y > height * 0.6))
        if (isInMapShape && Math.random() > 0.3) {
          dots.push({ x, y, radius: dotRadius, opacity: Math.random() * 0.5 + 0.2 })
        }
      }
    }
    return dots
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas?.parentElement) return
    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width, height })
      canvas.width = width
      canvas.height = height
    })
    resizeObserver.observe(canvas.parentElement)
    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const context = ctx as CanvasRenderingContext2D

    const dots = generateDots(dimensions.width, dimensions.height)
    let animationFrameId: number
    let startTime = Date.now()
    const w = dimensions.width
    const h = dimensions.height

    function drawDots() {
      context.clearRect(0, 0, w, h)
      dots.forEach((dot) => {
        context.beginPath()
        context.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2)
        context.fillStyle = `rgba(13, 148, 136, ${dot.opacity})`
        context.fill()
      })
    }

    function drawRoutes() {
      const currentTime = (Date.now() - startTime) / 1000
      routes.forEach((route) => {
        const elapsed = currentTime - route.start.delay
        if (elapsed <= 0) return
        const duration = 3
        const progress = Math.min(elapsed / duration, 1)
        const x = route.start.x + (route.end.x - route.start.x) * progress
        const y = route.start.y + (route.end.y - route.start.y) * progress
        context.beginPath()
        context.moveTo(route.start.x, route.start.y)
        context.lineTo(x, y)
        context.strokeStyle = route.color
        context.lineWidth = 1.5
        context.stroke()
        context.beginPath()
        context.arc(route.start.x, route.start.y, 3, 0, Math.PI * 2)
        context.fillStyle = route.color
        context.fill()
        context.beginPath()
        context.arc(x, y, 3, 0, Math.PI * 2)
        context.fillStyle = '#3F4ABF'
        context.fill()
        context.beginPath()
        context.arc(x, y, 6, 0, Math.PI * 2)
        context.fillStyle = 'rgba(63, 74, 191, 0.4)'
        context.fill()
        if (progress === 1) {
          context.beginPath()
          context.arc(route.end.x, route.end.y, 3, 0, Math.PI * 2)
          context.fillStyle = route.color
          context.fill()
        }
      })
    }

    function animate() {
      drawDots()
      drawRoutes()
      const currentTime = (Date.now() - startTime) / 1000
      if (currentTime > 15) startTime = Date.now()
      animationFrameId = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(animationFrameId)
  }, [dimensions])

  return (
    <div className="relative w-full h-full overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  )
}

interface SignInCardProps {
  onSubmit?: (email: string, password: string) => void | Promise<void>
  onGoogleClick?: () => void
  /** When provided, renders instead of the default Google button */
  googleButton?: React.ReactNode
  forgotPasswordHref?: string
  title?: string
  tagline?: string
}

export const SignInCard = ({
  onSubmit,
  onGoogleClick,
  googleButton,
  forgotPasswordHref = '#',
  title = 'Costra',
  tagline = 'Sign in to your cost dashboard and connect all your cloud providers',
}: SignInCardProps) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isHovered, setIsHovered] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Please enter email and password.')
      return
    }
    if (onSubmit) {
      setIsLoading(true)
      try {
        await onSubmit(email.trim(), password)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Sign in failed.')
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <div className="flex w-full h-full items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl overflow-hidden rounded-2xl flex bg-white shadow-xl border border-surface-200"
      >
        <div className="hidden md:block w-1/2 h-[600px] relative overflow-hidden border-r border-surface-200">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-50 to-surface-50">
            <DotMap />
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="mb-6"
              >
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center shadow-lg shadow-accent-200">
                  <ArrowRight className="text-white h-6 w-6" />
                </div>
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.5 }}
                className="text-3xl font-bold mb-2 text-center text-transparent bg-clip-text bg-gradient-to-r from-accent-600 to-accent-700"
              >
                {title}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="text-sm text-center text-gray-600 max-w-xs"
              >
                {tagline}
              </motion.p>
            </div>
          </div>
        </div>

        <div className="w-full md:w-1/2 p-8 md:p-10 flex flex-col justify-center bg-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-2xl md:text-3xl font-bold mb-1 text-gray-800">Welcome back</h1>
            <p className="text-gray-500 mb-8">Sign in to your account</p>

            <div className="mb-6">
              {googleButton ?? (
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-2 bg-surface-100 border border-surface-200 rounded-lg p-3 hover:bg-surface-200 transition-all duration-300 text-gray-700 shadow-sm"
                  onClick={onGoogleClick}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>Login with Google</span>
                </button>
              )}
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-surface-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="travel-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-accent-500">*</span>
                </label>
                <Input
                  id="travel-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  className="bg-surface-50 border-surface-200"
                />
              </div>

              <div>
                <label htmlFor="travel-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-accent-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    id="travel-password"
                    type={isPasswordVisible ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="bg-surface-50 border-surface-200 pr-10"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                    onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                    aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                  >
                    {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onHoverStart={() => setIsHovered(true)}
                onHoverEnd={() => setIsHovered(false)}
                className="pt-2"
              >
                <Button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    'w-full bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white py-2 rounded-lg transition-all duration-300 relative overflow-hidden',
                    isHovered ? 'shadow-lg shadow-accent-200' : ''
                  )}
                >
                  <span className="flex items-center justify-center">
                    {isLoading ? 'Signing in...' : 'Sign in'}
                    {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                  </span>
                  {isHovered && !isLoading && (
                    <motion.span
                      initial={{ left: '-100%' }}
                      animate={{ left: '100%' }}
                      transition={{ duration: 1, ease: 'easeInOut' as const }}
                      className="absolute top-0 bottom-0 left-0 w-20 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                      style={{ filter: 'blur(8px)' }}
                    />
                  )}
                </Button>
              </motion.div>

              <div className="text-center mt-6">
                {forgotPasswordHref.startsWith('/') ? (
                  <Link to={forgotPasswordHref} className="text-accent-600 hover:text-accent-700 text-sm transition-colors">
                    Forgot password?
                  </Link>
                ) : (
                  <a href={forgotPasswordHref} className="text-accent-600 hover:text-accent-700 text-sm transition-colors">
                    Forgot password?
                  </a>
                )}
              </div>
            </form>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

const TravelConnectSignInPage = () => (
  <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-accent-50/50 to-surface-100 p-4">
    <SignInCard />
  </div>
)

interface SignUpCardProps {
  onSubmit?: (name: string, email: string, password: string, consentAccepted: boolean) => void | Promise<void>
  googleButton?: React.ReactNode
  title?: string
  tagline?: string
}

const SignUpLeftPanel = ({ title, tagline }: { title: string; tagline: string }) => (
  <div className="hidden md:flex md:w-[42%] min-h-[640px] max-h-[90vh] relative overflow-hidden border-r border-surface-200/80 shrink-0">
    <div className="absolute inset-0 bg-gradient-to-br from-accent-50/90 to-surface-50">
      <DotMap />
      <div className="absolute inset-0 flex flex-col items-center justify-center p-10 z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mb-6"
        >
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center shadow-lg shadow-accent-200/50">
            <UserPlus className="text-white h-7 w-7" />
          </div>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="text-3xl font-bold mb-3 text-center text-transparent bg-clip-text bg-gradient-to-r from-accent-600 to-accent-700"
        >
          {title}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="text-sm text-center text-gray-600 max-w-[260px] leading-relaxed"
        >
          {tagline}
        </motion.p>
      </div>
    </div>
  </div>
)

export const SignUpCard = ({
  onSubmit,
  googleButton,
  title = 'Costra',
  tagline = 'Create your account and connect all your cloud providers in one place',
}: SignUpCardProps) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmVisible, setIsConfirmVisible] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }
    if (!consentAccepted) {
      setError('Please accept the Privacy Policy and Terms of Service.')
      return
    }
    if (onSubmit) {
      setIsLoading(true)
      try {
        await onSubmit(name.trim(), email.trim(), password, consentAccepted)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Sign up failed.')
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <div className="flex w-full min-h-[100dvh] md:min-h-0 items-center justify-center py-6 md:py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-4xl overflow-hidden rounded-2xl flex flex-col md:flex-row bg-white shadow-xl shadow-gray-200/50 border border-surface-200/80 max-h-[90vh] md:max-h-[min(640px,90vh)]"
      >
        <SignUpLeftPanel title={title} tagline={tagline} />

        <div className="w-full md:w-[58%] flex flex-col min-h-0">
          <div className="p-6 sm:p-8 md:p-8 overflow-y-auto flex-1">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="max-w-sm mx-auto md:mx-0"
            >
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create your account</h1>
              <p className="text-gray-500 text-sm mt-1 mb-6">Start managing your cloud costs today</p>

              <div className="mb-4">
                {googleButton ?? (
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-2.5 bg-white border border-surface-200 rounded-xl py-2.5 text-gray-700 text-sm font-medium hover:bg-surface-50 hover:border-surface-300 transition-colors shadow-sm"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Sign up with Google
                  </button>
                )}
              </div>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-surface-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2.5 bg-white text-gray-400 font-medium">or continue with email</span>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="signup-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <Input
                      id="signup-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      required
                      className="h-10 bg-surface-50/80 border-surface-200 pl-9 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <Input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      required
                      className="h-10 bg-surface-50/80 border-surface-200 pl-9 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <Input
                      id="signup-password"
                      type={isPasswordVisible ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      minLength={8}
                      className="h-10 bg-surface-50/80 border-surface-200 pl-9 pr-9 rounded-lg"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                      onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                      aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                    >
                      {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Min. 8 characters</p>
                </div>

                <div>
                  <label htmlFor="signup-confirm" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <Input
                      id="signup-confirm"
                      type={isConfirmVisible ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      required
                      minLength={8}
                      className="h-10 bg-surface-50/80 border-surface-200 pl-9 pr-9 rounded-lg"
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                      onClick={() => setIsConfirmVisible(!isConfirmVisible)}
                      aria-label={isConfirmVisible ? 'Hide password' : 'Show password'}
                    >
                      {isConfirmVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 pt-0.5">
                  <input
                    id="signup-consent"
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-surface-300 text-accent-600 focus:ring-accent-500/20"
                  />
                  <label htmlFor="signup-consent" className="text-xs text-gray-600 leading-snug cursor-pointer">
                    I agree to the{' '}
                    <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-accent-600 hover:text-accent-700 font-medium underline underline-offset-1">
                      Privacy Policy
                    </Link>{' '}
                    and{' '}
                    <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-accent-600 hover:text-accent-700 font-medium underline underline-offset-1">
                      Terms of Service
                    </Link>
                    , and consent to processing my data.
                  </label>
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50/80 border border-red-200/80 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <motion.div
                  whileHover={{ scale: 1.005 }}
                  whileTap={{ scale: 0.995 }}
                  onHoverStart={() => setIsHovered(true)}
                  onHoverEnd={() => setIsHovered(false)}
                  className="pt-1"
                >
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className={cn(
                      'w-full h-11 rounded-xl text-sm font-semibold bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white transition-all duration-300 relative overflow-hidden',
                      isHovered && !isLoading ? 'shadow-lg shadow-accent-300/40' : ''
                    )}
                  >
                    <span className="flex items-center justify-center gap-2">
                      {isLoading ? 'Creating account...' : 'Create account'}
                      {!isLoading && <UserPlus className="h-4 w-4" />}
                    </span>
                    {isHovered && !isLoading && (
                      <motion.span
                        initial={{ left: '-100%' }}
                        animate={{ left: '100%' }}
                        transition={{ duration: 1, ease: 'easeInOut' as const }}
                        className="absolute inset-0 w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        style={{ filter: 'blur(6px)' }}
                      />
                    )}
                  </Button>
                </motion.div>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link to="/login" className="text-accent-600 hover:text-accent-700 font-semibold">
                  Sign in
                </Link>
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default TravelConnectSignInPage
