import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { authenticateToken } from '../middleware/auth.js'
import { getCostDataForUser, getDailyCostData, getServiceCostsForDateRange } from '../database.js'
import logger from '../utils/logger.js'

const router = express.Router()

// Initialize Anthropic client
let anthropicClient = null

const getAnthropicClient = () => {
  if (!anthropicClient && process.env.ANTHROPIC_API_KEY) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return anthropicClient
}

// All routes require authentication
router.use(authenticateToken)

// Chat with AI about cost data
router.post('/chat', async (req, res) => {
  try {
    const userId = req.user.userId
    const { message, conversationHistory = [] } = req.body

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const client = getAnthropicClient()
    if (!client) {
      return res.status(503).json({ 
        error: 'AI service not configured',
        message: 'Please configure ANTHROPIC_API_KEY in environment variables'
      })
    }

    // Gather cost context for the AI
    const costContext = await gatherCostContext(userId)

    // Build the system prompt with cost context
    const systemPrompt = buildSystemPrompt(costContext)

    // Build messages array for Claude
    const messages = [
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ]

    logger.debug('AI Chat: Processing query', { 
      userId, 
      messagePreview: message.substring(0, 50) 
    })

    // Call Claude API
    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages
    })

    const aiResponse = response.content[0]?.text || 'I apologize, but I was unable to generate a response.'

    logger.debug('AI Chat: Response generated successfully', { userId })

    res.json({
      response: aiResponse,
      usage: {
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens
      }
    })

  } catch (error) {
    logger.error('AI Chat: Error', { 
      userId: req.user?.userId, 
      error: error.message, 
      status: error.status, 
      stack: error.stack 
    })
    
    if (error.status === 401) {
      return res.status(503).json({ error: 'Invalid AI API key' })
    }
    if (error.status === 429) {
      return res.status(429).json({ error: 'AI rate limit exceeded. Please try again later.' })
    }
    
    res.status(500).json({ error: 'Failed to process AI request' })
  }
})

// Get AI-generated insights
router.get('/insights', async (req, res) => {
  try {
    const userId = req.user.userId

    const client = getAnthropicClient()
    if (!client) {
      return res.status(503).json({ error: 'AI service not configured' })
    }

    const costContext = await gatherCostContext(userId)
    
    if (!costContext.hasData) {
      return res.json({ insights: [] })
    }

    const systemPrompt = `You are a cloud cost optimization expert. Analyze the following cost data and provide 3-5 actionable insights. Be specific and data-driven. Format each insight as a JSON object with "title", "description", "impact" (high/medium/low), and "type" (anomaly/optimization/trend/alert).

Return ONLY a valid JSON array, no other text.`

    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Analyze this cloud cost data and provide insights:\n\n${JSON.stringify(costContext, null, 2)}`
      }]
    })

    let insights = []
    try {
      const responseText = response.content[0]?.text || '[]'
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0])
      }
    } catch (parseError) {
      logger.error('AI Insights: Failed to parse insights', { 
        userId, 
        error: parseError.message, 
        stack: parseError.stack 
      })
    }

    res.json({ insights })

  } catch (error) {
    logger.error('AI Insights: Error', { 
      userId, 
      providerId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to generate insights' })
  }
})

// Get cost anomalies detected by AI
router.get('/anomalies', async (req, res) => {
  try {
    const userId = req.user.userId

    const client = getAnthropicClient()
    if (!client) {
      return res.status(503).json({ error: 'AI service not configured' })
    }

    const costContext = await gatherCostContext(userId)
    
    if (!costContext.hasData) {
      return res.json({ anomalies: [] })
    }

    const systemPrompt = `You are a cloud cost anomaly detection system. Analyze the cost data and identify any unusual patterns, spikes, or anomalies. For each anomaly found, provide:
- service: the affected service name
- description: what the anomaly is
- severity: critical/warning/info
- date: when it occurred (if applicable)
- percentageChange: the percentage increase/decrease

Return ONLY a valid JSON array of anomalies, no other text. If no anomalies are found, return an empty array [].`

    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Detect anomalies in this cloud cost data:\n\n${JSON.stringify(costContext, null, 2)}`
      }]
    })

    let anomalies = []
    try {
      const responseText = response.content[0]?.text || '[]'
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        anomalies = JSON.parse(jsonMatch[0])
      }
    } catch (parseError) {
      logger.error('AI Anomalies: Failed to parse anomalies', { 
        userId, 
        error: parseError.message, 
        stack: parseError.stack 
      })
    }

    res.json({ anomalies })

  } catch (error) {
    logger.error('AI Anomalies: Error', { 
      userId, 
      providerId, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to detect anomalies' })
  }
})

// Helper function to gather cost context for AI
async function gatherCostContext(userId) {
  const now = new Date()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

  try {
    // Get current month cost data
    const month = now.getMonth() + 1
    const year = now.getFullYear()
    const costData = await getCostDataForUser(userId, month, year)

    if (!costData || costData.length === 0) {
      return { hasData: false }
    }

    // Get daily data for trend analysis
    const providers = costData.map(c => c.provider_code)
    const dailyDataByProvider = {}

    for (const providerId of providers) {
      try {
        const dailyData = await getDailyCostData(
          userId,
          providerId,
          null,
          thirtyDaysAgo.toISOString().split('T')[0],
          now.toISOString().split('T')[0]
        )
        dailyDataByProvider[providerId] = dailyData || []
      } catch (e) {
        dailyDataByProvider[providerId] = []
      }
    }

    // Calculate summary metrics
    const totalCurrentMonth = costData.reduce((sum, c) => sum + parseFloat(c.current_month_cost || 0), 0)
    const totalLastMonth = costData.reduce((sum, c) => sum + parseFloat(c.last_month_cost || 0), 0)
    const totalCredits = costData.reduce((sum, c) => sum + parseFloat(c.credits || 0), 0)
    const monthOverMonthChange = totalLastMonth > 0 
      ? ((totalCurrentMonth - totalLastMonth) / totalLastMonth * 100).toFixed(1)
      : 0

    // Get service breakdown
    const serviceBreakdown = {}
    for (const cost of costData) {
      if (cost.services && cost.services.length > 0) {
        serviceBreakdown[cost.provider_code] = cost.services.map(s => ({
          name: s.service_name,
          cost: parseFloat(s.cost || 0),
          change: parseFloat(s.change_percent || 0)
        }))
      }
    }

    return {
      hasData: true,
      currentDate: now.toISOString().split('T')[0],
      summary: {
        totalCurrentMonth: totalCurrentMonth.toFixed(2),
        totalLastMonth: totalLastMonth.toFixed(2),
        monthOverMonthChange: `${monthOverMonthChange}%`,
        totalCredits: totalCredits.toFixed(2),
        numberOfProviders: providers.length
      },
      providers: costData.map(c => ({
        id: c.provider_code,
        name: c.provider_name,
        currentMonth: parseFloat(c.current_month_cost || 0).toFixed(2),
        lastMonth: parseFloat(c.last_month_cost || 0).toFixed(2),
        forecast: parseFloat(c.forecast_cost || 0).toFixed(2),
        credits: parseFloat(c.credits || 0).toFixed(2)
      })),
      serviceBreakdown,
      dailyTrends: Object.entries(dailyDataByProvider).map(([provider, data]) => ({
        provider,
        recentDays: data.slice(-7).map(d => ({
          date: d.date,
          cost: parseFloat(d.cost || 0).toFixed(2)
        }))
      }))
    }

  } catch (error) {
    logger.error('AI Context: Error gathering cost context', { 
      userId, 
      providerId, 
      error: error.message, 
      stack: error.stack 
    })
    return { hasData: false, error: error.message }
  }
}

// Helper function to build system prompt
function buildSystemPrompt(costContext) {
  return `You are an intelligent cloud cost management assistant for Costra, a multi-cloud cost tracking platform. You help users understand and optimize their cloud spending across AWS, Azure, GCP, DigitalOcean, IBM Cloud, Linode, and Vultr.

Your capabilities:
- Analyze cloud spending patterns and trends
- Identify cost anomalies and unusual charges
- Provide cost optimization recommendations
- Answer questions about specific services or time periods
- Help with budget planning and forecasting
- Explain cloud pricing concepts

Current User's Cost Data:
${JSON.stringify(costContext, null, 2)}

Guidelines:
1. Be specific and data-driven - reference actual numbers from the user's data
2. When suggesting optimizations, estimate potential savings when possible
3. Use clear, non-technical language unless the user asks for technical details
4. If you don't have enough data to answer a question, say so
5. Format responses with bullet points or numbered lists for clarity
6. Highlight important numbers or recommendations
7. Be concise but thorough

Remember: You have access to the user's actual cloud cost data shown above. Use it to provide personalized, actionable insights.`
}

export default router
