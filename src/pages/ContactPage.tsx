import { useState } from 'react'
import { Link } from 'react-router-dom'
import LandingNav from '../components/LandingNav'
import { Send, Mail, User, MessageSquare, CheckCircle } from 'lucide-react'
import { contactAPI } from '../services/api'

const CATEGORIES = [
  { value: 'bug_report', label: 'Bug Report' },
  { value: 'help', label: 'Help / Support' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'other', label: 'Other' },
]

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name || !email || !category || !subject || !message) {
      setError('All fields are required.')
      return
    }

    setIsLoading(true)

    try {
      await contactAPI.submit({ name, email, category, subject, message })
      setIsSubmitted(true)
    } catch (err: any) {
      let errorMessage = 'Failed to submit. Please try again.'
      if (err.message) {
        errorMessage = err.message
      }
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-surface-100 flex flex-col">
        <LandingNav />
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-16">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-surface-300 shadow-card p-10 text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Message Sent</h1>
            <p className="text-gray-500 mb-8 text-lg max-w-md mx-auto">
              Thank you for reaching out. We'll get back to you as soon as possible.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/" className="btn-secondary px-8 py-3 rounded-lg">
                Back to Home
              </Link>
              <button
                onClick={() => {
                  setIsSubmitted(false)
                  setName('')
                  setEmail('')
                  setCategory('')
                  setSubject('')
                  setMessage('')
                }}
                className="btn-primary px-8 py-3 rounded-lg"
              >
                Send Another
              </button>
            </div>
          </div>
        </div>
        <footer className="bg-surface-100 border-t border-surface-300 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-xs text-gray-400">
              A product of{' '}
              <a href="https://indraopstech.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition-colors">Indraops Technologies</a>
            </p>
          </div>
        </footer>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col">
      <LandingNav />

      {/* Wide content area */}
      <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* Left: intro (wider on large screens) */}
          <div className="lg:col-span-5">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Contact Us</h1>
            <p className="text-lg text-gray-600 mb-6">
              Have a question, found a bug, or want to request a feature? We typically respond within 24 hours.
            </p>
            <div className="space-y-4 text-gray-500">
              <p className="text-sm">
                For privacy or terms questions, see our{' '}
                <Link to="/privacy" className="text-accent-600 hover:text-accent-500 font-medium">Privacy Policy</Link>
                {' '}and{' '}
                <Link to="/terms" className="text-accent-600 hover:text-accent-500 font-medium">Terms of Service</Link>.
              </p>
            </div>
            <p className="mt-8 text-sm text-gray-500">
              <Link to="/" className="text-accent-600 hover:text-accent-500 font-semibold transition-colors">
                ← Back to Home
              </Link>
            </p>
          </div>

          {/* Right: form (wider card) */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl border border-surface-300 shadow-card p-8 lg:p-10">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-2">Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 text-gray-900 placeholder-gray-400 bg-white"
                        placeholder="Your name"
                        maxLength={200}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-2">Email address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 text-gray-900 placeholder-gray-400 bg-white"
                        placeholder="you@example.com"
                        maxLength={320}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-900 mb-2">Category</label>
                    <select
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-3 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 text-gray-900 bg-white"
                      required
                    >
                      <option value="" disabled>Select a category</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-gray-900 mb-2">Subject</label>
                    <div className="relative">
                      <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        id="subject"
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 text-gray-900 placeholder-gray-400 bg-white"
                        placeholder="Brief description"
                        maxLength={500}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-900 mb-2">Message</label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-4 py-3 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 text-gray-900 placeholder-gray-400 bg-white resize-y min-h-[160px]"
                    placeholder="Tell us more about your question or issue..."
                    rows={6}
                    maxLength={5000}
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">{message.length}/5000</p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full sm:w-auto sm:min-w-[200px] btn-primary py-3 px-6 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      <span>Send Message</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-surface-100 border-t border-surface-300 py-10 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500 space-y-2 sm:space-y-0">
            <p>&copy; {new Date().getFullYear()} Costra. All rights reserved.</p>
            <div className="flex space-x-6">
              <Link to="/privacy" className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-gray-900 transition-colors">Terms of Service</Link>
              <Link to="/contact" className="hover:text-gray-900 transition-colors">Contact Us</Link>
              <Link to="/blog" className="hover:text-gray-900 transition-colors">Blog</Link>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">
            A product of{' '}
            <a href="https://indraopstech.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition-colors">Indraops Technologies</a>
          </p>
        </div>
      </footer>
    </div>
  )
}
