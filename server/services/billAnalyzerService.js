/**
 * Bill Analyzer Service
 * Handles AI-powered cloud bill analysis, credit management, and file parsing
 */

import { pool } from '../database.js'
import { getUserSubscription } from './subscriptionService.js'
import { getAnthropicClient } from '../utils/aiClient.js'
import logger from '../utils/logger.js'

// Credit limits per plan
const CREDIT_LIMITS = {
  trial: 0,
  starter: 50,
  pro: 300,
}

/**
 * Calculate credit cost based on file size
 */
export const getCreditCost = (fileSizeBytes) => {
  const mb = fileSizeBytes / (1024 * 1024)
  if (mb < 5) return 5
  if (mb <= 15) return 10
  return 20
}

/**
 * Get or create a credit record for the current billing period.
 * Automatically resets credits when a new month starts.
 */
export const getOrCreateCreditRecord = async (userId) => {
  const subscription = await getUserSubscription(userId)
  const planType = subscription.plan_type
  const limit = CREDIT_LIMITS[planType] || 0

  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const periodStartStr = periodStart.toISOString().split('T')[0]
  const periodEndStr = periodEnd.toISOString().split('T')[0]

  const result = await pool.query(
    `INSERT INTO bill_analyzer_credits (user_id, credits_used, credits_limit, period_start, period_end)
     VALUES ($1, 0, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       credits_limit = $2,
       credits_used = CASE
         WHEN bill_analyzer_credits.period_start < $3::date THEN 0
         ELSE bill_analyzer_credits.credits_used
       END,
       period_start = CASE
         WHEN bill_analyzer_credits.period_start < $3::date THEN $3::date
         ELSE bill_analyzer_credits.period_start
       END,
       period_end = $4::date,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [userId, limit, periodStartStr, periodEndStr]
  )
  return result.rows[0]
}

/**
 * Consume credits for an analysis. Throws if insufficient.
 */
export const consumeCredits = async (userId, amount) => {
  const record = await getOrCreateCreditRecord(userId)
  const remaining = record.credits_limit - record.credits_used
  if (remaining < amount) {
    throw new Error(`Insufficient credits. Need ${amount}, have ${remaining}.`)
  }
  await pool.query(
    'UPDATE bill_analyzer_credits SET credits_used = credits_used + $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
    [userId, amount]
  )
}

/**
 * Get current credit balance for user
 */
export const getCreditBalance = async (userId) => {
  const record = await getOrCreateCreditRecord(userId)
  return {
    used: record.credits_used,
    limit: record.credits_limit,
    remaining: record.credits_limit - record.credits_used,
    periodStart: record.period_start,
    periodEnd: record.period_end,
  }
}

/**
 * Parse CSV buffer to text for AI analysis
 */
export const parseCSV = (buffer) => {
  const text = buffer.toString('utf-8')
  // Truncate to ~100KB to fit in context window
  return text.substring(0, 100000)
}

/**
 * Parse Excel buffer to text for AI analysis
 */
export const parseExcel = async (buffer) => {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  let result = ''
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    result += `Sheet: ${sheetName}\n`
    result += XLSX.utils.sheet_to_csv(sheet)
    result += '\n\n'
  }
  // Truncate for context window
  return result.substring(0, 100000)
}

const BILL_ANALYSIS_SYSTEM_PROMPT = `You are an expert cloud billing analyst. Analyze the provided cloud bill and extract structured information.

Return ONLY a valid JSON object with this exact structure:
{
  "provider": "AWS|Azure|GCP|DigitalOcean|Other|Unknown",
  "billingPeriod": "YYYY-MM to YYYY-MM or description",
  "totalCost": 1234.56,
  "grossCost": 1500.00,
  "credits": 265.44,
  "currency": "USD",
  "services": [
    { "name": "Service Name", "cost": 123.45, "percentage": 10.0, "region": "us-east-1" }
  ],
  "regions": [
    { "name": "us-east-1", "cost": 456.78, "percentage": 37.0 }
  ],
  "costDrivers": [
    { "description": "What is driving cost", "impact": "high|medium|low", "amount": 100.00 }
  ],
  "optimizations": [
    { "title": "Suggestion title", "description": "Detailed suggestion", "estimatedSavings": "$50-100/month", "priority": "high|medium|low" }
  ],
  "summary": "Brief 2-3 sentence summary of the bill highlighting the total amount, highest cost service, and any notable patterns."
}

CRITICAL guidelines for cost extraction:
- "totalCost" is the final amount due (net, after credits/discounts)
- "grossCost" is the total charges BEFORE credits and discounts are applied
- "credits" is the total amount of credits/discounts applied
- For services: ALWAYS use the GROSS cost (pre-credit, pre-discount) for each service, NOT the net/zero amount. The breakdown must show what each service actually costs before credits are applied. This is essential for a meaningful breakdown.
- Calculate percentages relative to grossCost (not totalCost)
- For regions: use short names like "us-east-1", "eu-west-1", "ap-south-1" — NOT long descriptions. If the exact region is unknown, use the billing entity location (e.g. "ap-south-1" for India)

Other guidelines:
- Identify the cloud provider from logos, headers, or service names
- Extract ALL services with their individual costs
- Identify regions from service details or headers
- Highlight the top cost drivers (services causing the most spend)
- Provide actionable optimization suggestions with estimated savings
- If you cannot determine a field, use null
- Always try to identify the cloud provider and total cost
- For currencies, use the ISO 4217 code (USD, EUR, GBP, INR, etc.)`

/**
 * Select the right Claude model based on file type.
 * PDFs require document support (Sonnet), images and text use Haiku.
 */
const getModelForFileType = (mimeType) => {
  if (mimeType === 'application/pdf') {
    return 'claude-sonnet-4-6'
  }
  return 'claude-3-haiku-20240307'
}

/**
 * Analyze a bill using Claude AI
 * @param {Buffer|string} fileData - File buffer (images/PDFs) or text string (CSV/Excel)
 * @param {string} fileName - Original file name
 * @param {string} mimeType - MIME type of the file
 */
export const analyzeBill = async (fileData, fileName, mimeType) => {
  const client = getAnthropicClient()
  if (!client) throw new Error('AI service not configured. Set ANTHROPIC_API_KEY.')

  const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)
  const isPdf = mimeType === 'application/pdf'
  const model = getModelForFileType(mimeType)

  let messages

  if (isImage) {
    const base64Data = fileData.toString('base64')
    messages = [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mimeType, data: base64Data },
        },
        {
          type: 'text',
          text: `Analyze this cloud billing document (${fileName}) and extract the structured billing information.`,
        },
      ],
    }]
  } else if (isPdf) {
    const base64Data = fileData.toString('base64')
    messages = [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
        },
        {
          type: 'text',
          text: `Analyze this cloud billing document (${fileName}) and extract the structured billing information.`,
        },
      ],
    }]
  } else {
    // Text content (pre-parsed CSV/Excel)
    messages = [{
      role: 'user',
      content: `Analyze this cloud billing data from file "${fileName}":\n\n${fileData}`,
    }]
  }

  logger.info('Calling Claude for bill analysis', { fileName, mimeType, model })

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: BILL_ANALYSIS_SYSTEM_PROMPT,
    messages,
  })

  const responseText = response.content[0]?.text || '{}'

  // Parse JSON from response (handle markdown code blocks)
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) || responseText.match(/(\{[\s\S]*\})/)
  if (!jsonMatch) {
    logger.error('Failed to parse bill analysis response', { responseText: responseText.substring(0, 500) })
    throw new Error('Failed to parse analysis response from AI')
  }

  const jsonStr = jsonMatch[1] || jsonMatch[0]
  const analysis = JSON.parse(jsonStr)

  logger.info('Bill analysis completed', {
    fileName,
    provider: analysis.provider,
    totalCost: analysis.totalCost,
    servicesCount: analysis.services?.length,
  })

  return analysis
}
