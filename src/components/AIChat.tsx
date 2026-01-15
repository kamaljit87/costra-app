import { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Send, Sparkles, Bot, User, Loader2, AlertCircle, Lightbulb, TrendingUp, AlertTriangle } from 'lucide-react'

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
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 ${isOpen ? 'hidden' : ''}`}
        title="AI Cost Assistant"
      >
        <Sparkles className="h-6 w-6" />
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">AI Cost Assistant</h3>
                  <p className="text-xs text-white/80">Powered by Claude</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'chat' 
                    ? 'bg-white text-violet-600' 
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <MessageSquare className="h-4 w-4 inline mr-2" />
                Chat
              </button>
              <button
                onClick={() => setActiveTab('insights')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'insights' 
                    ? 'bg-white text-violet-600' 
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <Lightbulb className="h-4 w-4 inline mr-2" />
                Insights
              </button>
            </div>
          </div>

          {/* Content */}
          {activeTab === 'chat' ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-violet-100 to-indigo-100 flex items-center justify-center">
                      <Sparkles className="h-8 w-8 text-violet-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2">How can I help you?</h4>
                    <p className="text-sm text-gray-500 mb-6">
                      Ask me anything about your cloud costs
                    </p>
                    <div className="space-y-2">
                      {suggestedQuestions.map((question, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setInputValue(question)
                            inputRef.current?.focus()
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-600 bg-white rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        message.role === 'user' 
                          ? 'bg-violet-600 text-white' 
                          : 'bg-gradient-to-r from-violet-100 to-indigo-100 text-violet-600'
                      }`}>
                        {message.role === 'user' ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </div>
                      <div className={`flex-1 max-w-[80%] ${message.role === 'user' ? 'text-right' : ''}`}>
                        <div className={`inline-block px-4 py-2 rounded-2xl ${
                          message.role === 'user'
                            ? 'bg-violet-600 text-white rounded-tr-sm'
                            : 'bg-white text-gray-800 rounded-tl-sm shadow-sm border border-gray-100'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 px-1">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-violet-100 to-indigo-100 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-violet-600" />
                    </div>
                    <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm border border-gray-100">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-200 bg-white">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about your cloud costs..."
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
                    disabled={isLoading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    className="p-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Insights Tab */
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {isLoadingInsights ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-600 mb-4" />
                  <p className="text-sm text-gray-500">Analyzing your cost data...</p>
                </div>
              ) : insights.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                    <Lightbulb className="h-8 w-8 text-gray-400" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">No insights yet</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    AI insights will appear here once you have cost data
                  </p>
                  <button
                    onClick={fetchInsights}
                    className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 transition-colors"
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
                        <div className="mt-0.5">
                          {getInsightIcon(insight.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-semibold text-sm">{insight.title}</h5>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              insight.impact === 'high' ? 'bg-red-100 text-red-700' :
                              insight.impact === 'medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {insight.impact} impact
                            </span>
                          </div>
                          <p className="text-sm opacity-80">{insight.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <button
                    onClick={fetchInsights}
                    className="w-full mt-4 px-4 py-2 text-sm text-violet-600 hover:bg-violet-50 rounded-lg transition-colors flex items-center justify-center gap-2"
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
