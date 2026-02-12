import Anthropic from '@anthropic-ai/sdk'
import logger from './logger.js'

let anthropicClient = null

export const getAnthropicClient = () => {
  if (!anthropicClient && process.env.ANTHROPIC_API_KEY) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return anthropicClient
}

/**
 * Call Claude Haiku with a system prompt and user message.
 * Returns the response text or null on failure.
 */
export const callClaude = async (systemPrompt, userMessage, maxTokens = 1024) => {
  const client = getAnthropicClient()
  if (!client) return null

  try {
    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })
    return response.content[0]?.text || null
  } catch (error) {
    logger.error('Claude API call failed', { error: error.message, status: error.status })
    return null
  }
}
