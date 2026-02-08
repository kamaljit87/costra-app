import { useState, useRef, useEffect } from 'react'
import { X, Send, Headphones, Loader2, RotateCcw } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { contactAPI } from '../services/api'

type Step = 'greeting' | 'subject' | 'message' | 'confirm' | 'submitting' | 'success' | 'error'

interface ChatMessage {
  role: 'bot' | 'user'
  content: string
}

const CATEGORIES = [
  { value: 'bug_report', label: 'Bug Report' },
  { value: 'help', label: 'Help / Support' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'other', label: 'Other' },
]

interface ContactChatProps {
  isOpen: boolean
  onClose: () => void
}

export default function ContactChat({ isOpen, onClose }: ContactChatProps) {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('greeting')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [category, setCategory] = useState('')
  const [categoryLabel, setCategoryLabel] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [inputValue, setInputValue] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, step])

  // Reset state when panel opens
  useEffect(() => {
    if (isOpen) {
      setStep('greeting')
      setCategory('')
      setCategoryLabel('')
      setSubject('')
      setMessage('')
      setInputValue('')
            const firstName = user?.name?.split(' ')[0] || 'there'
      setMessages([
        { role: 'bot', content: `Hi ${firstName}! How can we help you today?` },
      ])
    }
  }, [isOpen, user?.name])

  // Focus input when step changes
  useEffect(() => {
    if (step === 'subject') {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else if (step === 'message') {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [step])

  const handleCategorySelect = (cat: typeof CATEGORIES[0]) => {
    setCategory(cat.value)
    setCategoryLabel(cat.label)
    setMessages(prev => [
      ...prev,
      { role: 'user', content: cat.label },
      { role: 'bot', content: "Got it. What's the subject of your message?" },
    ])
    setStep('subject')
  }

  const handleSubjectSubmit = () => {
    const val = inputValue.trim()
    if (!val) return
    setSubject(val)
    setInputValue('')
    setMessages(prev => [
      ...prev,
      { role: 'user', content: val },
      { role: 'bot', content: 'Please describe the issue or question in detail:' },
    ])
    setStep('message')
  }

  const handleMessageSubmit = () => {
    const val = inputValue.trim()
    if (!val) return
    setMessage(val)
    setInputValue('')
    setMessages(prev => [
      ...prev,
      { role: 'user', content: val },
      { role: 'bot', content: `Ready to send your ${categoryLabel} message:\n\n"${subject}"\n\nClick Send to submit, or close to cancel.` },
    ])
    setStep('confirm')
  }

  const handleSend = async () => {
    if (!user) return
    setStep('submitting')
    setMessages(prev => [
      ...prev,
      { role: 'bot', content: 'Sending your message...' },
    ])

    try {
      await contactAPI.submit({
        name: user.name,
        email: user.email,
        category,
        subject,
        message,
      })
      setMessages(prev => {
        const updated = prev.slice(0, -1) // remove "Sending..." message
        return [
          ...updated,
          { role: 'bot', content: `Your message has been sent! We'll get back to you at ${user.email} as soon as possible.` },
        ]
      })
      setStep('success')
    } catch (err: any) {
      const errMsg = err.message || 'Something went wrong. Please try again.'
      setMessages(prev => {
        const updated = prev.slice(0, -1)
        return [
          ...updated,
          { role: 'bot', content: `Sorry, we couldn't send your message: ${errMsg}` },
        ]
      })
      setStep('error')
    }
  }

  const handleStartOver = () => {
    const firstName = user?.name?.split(' ')[0] || 'there'
    setStep('greeting')
    setCategory('')
    setCategoryLabel('')
    setSubject('')
    setMessage('')
    setInputValue('')
        setMessages([
      { role: 'bot', content: `Hi ${firstName}! How can we help you today?` },
    ])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (step === 'subject') handleSubjectSubmit()
      else if (step === 'message') handleMessageSubmit()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-3rem)] bg-white rounded-2xl shadow-2xl border border-surface-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="bg-gradient-to-br from-accent-600 to-accent-700 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Headphones className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">Contact Support</h3>
              <p className="text-xs text-white/80">We'll get back to you soon</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-50">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              msg.role === 'user'
                ? 'bg-accent-600 text-white'
                : 'bg-accent-100 text-accent-600'
            }`}>
              {msg.role === 'user' ? (
                <span className="text-xs font-bold">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
              ) : (
                <Headphones className="h-4 w-4" />
              )}
            </div>
            <div className={`flex-1 max-w-[80%] ${msg.role === 'user' ? 'text-right' : ''}`}>
              <div className={`inline-block px-4 py-2.5 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-accent-600 text-white rounded-tr-sm'
                  : 'bg-white text-gray-800 rounded-tl-sm shadow-sm border border-surface-100'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          </div>
        ))}

        {/* Category quick-reply buttons */}
        {step === 'greeting' && (
          <div className="flex flex-wrap gap-2 ml-11">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => handleCategorySelect(cat)}
                className="px-4 py-2 text-sm font-medium text-accent-700 bg-white border border-accent-200 rounded-full hover:bg-accent-50 hover:border-accent-400 transition-colors"
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Submitting spinner */}
        {step === 'submitting' && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center">
              <Headphones className="h-4 w-4 text-accent-600" />
            </div>
            <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm border border-surface-100">
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Sending...</span>
              </div>
            </div>
          </div>
        )}

        {/* Success actions */}
        {step === 'success' && (
          <div className="flex gap-2 ml-11">
            <button
              onClick={handleStartOver}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-accent-700 bg-white border border-accent-200 rounded-full hover:bg-accent-50 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Send Another
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-surface-300 rounded-full hover:bg-surface-100 transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {/* Error retry */}
        {step === 'error' && (
          <div className="flex gap-2 ml-11">
            <button
              onClick={handleSend}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-accent-700 bg-white border border-accent-200 rounded-full hover:bg-accent-50 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Try Again
            </button>
            <button
              onClick={handleStartOver}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-surface-300 rounded-full hover:bg-surface-100 transition-colors"
            >
              Start Over
            </button>
          </div>
        )}

        {/* Confirm send button */}
        {step === 'confirm' && (
          <div className="flex gap-2 ml-11">
            <button
              onClick={handleSend}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-accent-600 rounded-full hover:bg-accent-700 transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
              Send Message
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-surface-300 rounded-full hover:bg-surface-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area — only shown for subject and message steps */}
      {(step === 'subject' || step === 'message') && (
        <div className="p-4 border-t border-surface-200 bg-white">
          {step === 'subject' ? (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter subject..."
                maxLength={500}
                className="flex-1 px-4 py-2 border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 text-sm"
              />
              <button
                onClick={handleSubjectSubmit}
                disabled={!inputValue.trim()}
                className="p-2 bg-accent-600 text-white rounded-xl hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your issue or question..."
                maxLength={5000}
                rows={3}
                className="flex-1 px-4 py-2 border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 text-sm resize-none"
              />
              <button
                onClick={handleMessageSubmit}
                disabled={!inputValue.trim()}
                className="p-2 bg-accent-600 text-white rounded-xl hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
