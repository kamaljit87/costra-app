/**
 * Bill Analyzer Routes
 * Upload and analyze cloud billing files with AI
 */

import express from 'express'
import multer from 'multer'
import { authenticateToken } from '../middleware/auth.js'
import { requireFeature } from '../middleware/featureGate.js'
import { aiLimiter } from '../middleware/rateLimiter.js'
import { saveBillAnalysis, getBillAnalyses, getBillAnalysisById, deleteBillAnalysis } from '../database.js'
import {
  analyzeBill,
  getCreditBalance,
  consumeCredits,
  getCreditCost,
  parseCSV,
  parseExcel,
} from '../services/billAnalyzerService.js'
import logger from '../utils/logger.js'

const router = express.Router()

// Memory storage - files are processed then discarded
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = /\.(pdf|csv|xlsx|xls|jpeg|jpg|png|gif|webp)$/i
    const allowedMimes = [
      'application/pdf',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ]
    const extOk = allowedExtensions.test(file.originalname)
    const mimeOk = allowedMimes.includes(file.mimetype)
    if (extOk && mimeOk) {
      cb(null, true)
    } else {
      cb(new Error('Unsupported file type. Accepted: PDF, CSV, Excel, JPEG, PNG, GIF, WebP'))
    }
  },
})

// All routes require auth + bill_analyzer feature
router.use(authenticateToken)
router.use(requireFeature('bill_analyzer'))

/**
 * POST /upload
 * Upload and analyze a cloud billing file
 */
router.post('/upload', aiLimiter, (req, res, next) => {
  // Extend timeout for AI processing
  req.setTimeout(120000)
  next()
}, upload.single('file'), async (req, res) => {
  try {
    const userId = req.user.userId
    const file = req.file
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    // Check credits
    const creditCost = getCreditCost(file.size)
    const balance = await getCreditBalance(userId)
    if (balance.remaining < creditCost) {
      return res.status(402).json({
        error: 'Insufficient AI credits',
        required: creditCost,
        remaining: balance.remaining,
        limit: balance.limit,
      })
    }

    // Parse non-vision files to text
    let fileData = file.buffer
    let mimeType = file.mimetype
    const isCSV = file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')
    const isExcel = file.mimetype.includes('spreadsheet') || file.mimetype.includes('ms-excel') ||
                    file.originalname.toLowerCase().endsWith('.xlsx') || file.originalname.toLowerCase().endsWith('.xls')

    if (isCSV) {
      fileData = parseCSV(file.buffer)
      mimeType = 'text/plain'
    } else if (isExcel) {
      fileData = await parseExcel(file.buffer)
      mimeType = 'text/plain'
    }

    // Call Claude for analysis
    const analysis = await analyzeBill(fileData, file.originalname, mimeType)

    // Consume credits
    await consumeCredits(userId, creditCost)

    // Save to DB
    const saved = await saveBillAnalysis(userId, {
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype,
      provider: analysis.provider,
      billingPeriod: analysis.billingPeriod,
      totalCost: analysis.totalCost,
      currency: analysis.currency,
      services: analysis.services,
      regions: analysis.regions,
      costDrivers: analysis.costDrivers,
      optimizations: analysis.optimizations,
      summary: analysis.summary,
      rawAnalysis: analysis,
      creditsConsumed: creditCost,
    })

    // File buffer is garbage collected - no cleanup needed

    res.json({
      analysis: saved,
      credits: await getCreditBalance(userId),
    })
  } catch (error) {
    logger.error('Bill analysis failed', { userId: req.user?.userId, error: error.message })
    if (error.message.includes('Insufficient credits')) {
      return res.status(402).json({ error: error.message })
    }
    res.status(500).json({ error: error.message || 'Failed to analyze bill' })
  }
})

/**
 * GET /credits
 * Get current credit balance
 */
router.get('/credits', async (req, res) => {
  try {
    const balance = await getCreditBalance(req.user.userId)
    res.json(balance)
  } catch (error) {
    logger.error('Failed to get credit balance', { userId: req.user?.userId, error: error.message })
    res.status(500).json({ error: 'Failed to get credit balance' })
  }
})

/**
 * GET /analyses
 * List past analyses
 */
router.get('/analyses', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const offset = parseInt(req.query.offset) || 0
    const analyses = await getBillAnalyses(req.user.userId, limit, offset)
    res.json({ analyses })
  } catch (error) {
    logger.error('Failed to get analyses', { userId: req.user?.userId, error: error.message })
    res.status(500).json({ error: 'Failed to get analyses' })
  }
})

/**
 * GET /analyses/:id
 * Get a specific analysis
 */
router.get('/analyses/:id', async (req, res) => {
  try {
    const analysis = await getBillAnalysisById(req.user.userId, parseInt(req.params.id))
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' })
    }
    res.json({ analysis })
  } catch (error) {
    logger.error('Failed to get analysis', { userId: req.user?.userId, id: req.params.id, error: error.message })
    res.status(500).json({ error: 'Failed to get analysis' })
  }
})

/**
 * DELETE /analyses/:id
 * Delete an analysis
 */
router.delete('/analyses/:id', async (req, res) => {
  try {
    const deleted = await deleteBillAnalysis(req.user.userId, parseInt(req.params.id))
    if (!deleted) {
      return res.status(404).json({ error: 'Analysis not found' })
    }
    res.json({ success: true })
  } catch (error) {
    logger.error('Failed to delete analysis', { userId: req.user?.userId, id: req.params.id, error: error.message })
    res.status(500).json({ error: 'Failed to delete analysis' })
  }
})

export default router
