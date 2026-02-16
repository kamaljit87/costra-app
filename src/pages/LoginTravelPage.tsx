import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { usePublicConfig } from '../contexts/PublicConfigContext'
import { SignInCard } from '../components/ui/travel-connect-signin-1'
import GoogleSignInButton from '../components/GoogleSignInButton'
import Logo from '../components/Logo'

export default function LoginTravelPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { signupDisabled } = usePublicConfig()

  const handleSubmit = async (email: string, password: string) => {
    const result = await login(email, password)
    if (result.ok) {
      navigate('/dashboard')
      return
    }
    if (result.twoFactorRequired && result.temporaryToken && result.user) {
      navigate('/auth/verify-2fa', { state: { temporaryToken: result.temporaryToken, user: result.user }, replace: true })
      return
    }
    throw new Error('Invalid credentials')
  }

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col">
      <div className="py-4 px-6 border-b border-surface-200 bg-white">
        <Link to="/" className="inline-block">
          <Logo height={40} />
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <SignInCard
            title="Costra"
            tagline="Sign in to your cost dashboard and connect all your cloud providers"
            forgotPasswordHref="/forgot-password"
            onSubmit={handleSubmit}
            googleButton={<GoogleSignInButton mode="signin" />}
          />
          {!signupDisabled && (
            <p className="mt-6 text-center text-sm text-gray-500">
              Don&apos;t have an account?{' '}
              <Link to="/signup" className="text-accent-600 hover:text-accent-700 font-medium">
                Sign up for free
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
