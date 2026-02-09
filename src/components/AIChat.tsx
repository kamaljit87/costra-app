import { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Send, Sparkles, Bot, Loader2, AlertCircle, Lightbulb, TrendingUp, AlertTriangle } from 'lucide-react'
import {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
} from '@/components/ui/chat-bubble'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface Insight {
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  type: 'anomaly' | 'optimization' | 'trend' | 'alert'
}

export default function AIChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [insights, setInsights] = useState<Insight[]>([])
  const [isLoadingInsights, setIsLoadingInsights] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'insights'>('chat')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      inputRef.current?.focus()
    }
  }, [isOpen, activeTab])

  // Fetch insights when opening insights tab
  useEffect(() => {
    if (isOpen && activeTab === 'insights' && insights.length === 0) {
      fetchInsights()
    }
  }, [isOpen, activeTab])

  const fetchInsights = async () => {
    setIsLoadingInsights(true)
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/ai/insights', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setInsights(data.insights || [])
      }
    } catch (err) {
      console.error('Failed to fetch insights:', err)
    } finally {
      setIsLoadingInsights(false)
    }
  }

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response')
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (err: any) {
      setError(err.message || 'Failed to send message')
      // Remove the user message if we couldn't get a response
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const suggestedQuestions = [
    "Why did my costs increase this month?",
    "Which services are costing me the most?",
    "How can I reduce my cloud spending?",
    "What's my cost forecast for next month?"
  ]

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'anomaly': return <AlertTriangle className="h-4 w-4" />
      case 'optimization': return <Lightbulb className="h-4 w-4" />
      case 'trend': return <TrendingUp className="h-4 w-4" />
      case 'alert': return <AlertCircle className="h-4 w-4" />
      default: return <Sparkles className="h-4 w-4" />
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200'
      case 'medium': return 'text-amber-600 bg-amber-50 border-amber-200'
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-900/25 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 ${isOpen ? 'hidden' : ''}`}
        title="AI Cost Assistant"
      >
        <Sparkles className="h-6 w-6" />
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[600px] bg-white rounded-2xl shadow-2xl shadow-primary-900/10 border border-surface-200/80 flex flex-col overflow-hidden ring-1 ring-black/5">
          {/* Header */}
          <div className="bg-gradient-to-br from-primary-800 to-primary-900 px-5 pt-4 pb-4 text-white shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/10">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold tracking-tight">AI Cost Assistant</h3>
                  <p className="text-xs text-white/70 mt-0.5">Powered by Claude</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-white/80 hover:bg-white/15 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 mt-4 p-1 rounded-xl bg-white/10">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                  activeTab === 'chat'
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-white/90 hover:bg-white/10'
                }`}
              >
                <MessageSquare className="h-4 w-4" />
                Chat
              </button>
              <button
                onClick={() => setActiveTab('insights')}
                className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                  activeTab === 'insights'
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-white/90 hover:bg-white/10'
                }`}
              >
                <Lightbulb className="h-4 w-4" />
                Insights
              </button>
            </div>
          </div>

          {/* Content */}
          {activeTab === 'chat' ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-white">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center pt-6 pb-4">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center mb-5 ring-4 ring-primary-50/50">
                      <Sparkles className="h-10 w-10 text-primary-500" />
                    </div>
                    <h4 className="text-xl font-semibold text-gray-900 tracking-tight mb-1.5">How can I help you?</h4>
                    <p className="text-sm text-gray-500 mb-8">
                      Ask me anything about your cloud costs
                    </p>
                    <div className="w-full space-y-2.5 max-w-sm">
                      {suggestedQuestions.map((question, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setInputValue(question)
                            inputRef.current?.focus()
                          }}
                          className="block w-full text-left px-4 py-3 text-sm text-gray-600 bg-white rounded-xl border border-surface-200 hover:border-primary-200 hover:bg-primary-50/50 hover:text-gray-900 transition-all duration-200 shadow-sm"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((message, index) => (
                      <ChatBubble
                        key={index}
                        variant={message.role === 'user' ? 'sent' : 'received'}
                      >
                        <ChatBubbleAvatar
                          fallback={message.role === 'user' ? 'US' : 'AI'}
                        />
                        <div className="flex-1 min-w-0">
                          <ChatBubbleMessage
                            variant={message.role === 'user' ? 'sent' : 'received'}
                            className={message.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          </ChatBubbleMessage>
                          <p className="text-xs text-muted-foreground mt-1 px-1">
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </ChatBubble>
                    ))}

                    {isLoading && (
                      <ChatBubble variant="received">
                        <ChatBubbleAvatar fallback="AI" />
                        <ChatBubbleMessage isLoading />
                      </ChatBubble>
                    )}
                  </>
                )}

                {error && (
                  <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-surface-100 bg-white shrink-0">
                <div className="flex gap-2.5">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about your cloud costs..."
                    className="flex-1 px-4 py-2.5 border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 text-sm text-gray-900 placeholder:text-gray-400 transition-shadow"
                    disabled={isLoading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    className="w-11 h-11 flex items-center justify-center rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    aria-label="Send"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Insights Tab */
            <div className="flex-1 overflow-y-auto p-5 bg-white">
              {isLoadingInsights ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
                    <Loader2 className="h-7 w-7 animate-spin text-primary-500" />
                  </div>
                  <p className="text-sm text-gray-500">Analyzing your cost data...</p>
                </div>
              ) : insights.length === 0 ? (
                <div className="flex flex-col items-center py-16">
                  <div className="w-20 h-20 rounded-full bg-surface-100 flex items-center justify-center mb-5 ring-4 ring-surface-50">
                    <Lightbulb className="h-10 w-10 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-1.5">No insights yet</h4>
                  <p className="text-sm text-gray-500 mb-6 text-center max-w-xs">
                    AI insights will appear here once you have cost data
                  </p>
                  <button
                    onClick={fetchInsights}
                    className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
                  >
                    Refresh Insights
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {insights.map((insight, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-xl border ${getImpactColor(insight.impact)}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          {getInsightIcon(insight.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h5 className="font-semibold text-sm text-gray-900">{insight.title}</h5>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              insight.impact === 'high' ? 'bg-red-100 text-red-700' :
                              insight.impact === 'medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {insight.impact} impact
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{insight.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={fetchInsights}
                    className="w-full mt-4 px-4 py-2.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Refresh Insights
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}
