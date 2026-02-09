import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import GoogleSignInButton from '../components/GoogleSignInButton'
import Logo from '../components/Logo'
import { SignUpCard } from '../components/ui/travel-connect-signin-1'

export default function SignupTravelPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (
    name: string,
    email: string,
    password: string,
    consentAccepted: boolean
  ) => {
    const success = await signup(name, email, password, consentAccepted)
    if (!success) {
      throw new Error('Sign up failed. Please try again.')
    }
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col">
      <div className="py-4 px-6 border-b border-surface-200 bg-white shrink-0">
        <Link to="/" className="inline-block">
          <Logo height={40} />
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <SignUpCard
        onSubmit={handleSubmit}
        googleButton={<GoogleSignInButton mode="signup" />}
        title="Costra"
        tagline="Create your account and connect all your cloud providers in one place"
      />
      </div>
    </div>
  )
}
