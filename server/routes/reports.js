import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import {
  generateReportData,
  saveReport,
  getReports,
  getReport,
  updateReportStatus,
  deleteReport,
} from '../database.js'
import { generateCSVReport, generatePDFReport } from '../utils/reportGenerator.js'
import path from 'path'
import fs from 'fs/promises'

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

/**
 * POST /api/reports/showback
 * Generate a showback report
 */
router.post('/showback', async (req, res) => {
  try {
    const userId = req.user.id
    const { reportName, startDate, endDate, providerId, accountId, teamName, productName, format = 'csv' } = req.body
    
    if (!reportName || !startDate || !endDate) {
      return res.status(400).json({ error: 'reportName, startDate, and endDate are required' })
    }
    
    if (!['csv', 'pdf'].includes(format)) {
      return res.status(400).json({ error: 'format must be csv or pdf' })
    }
    
    // Generate report data
    const reportData = await generateReportData(userId, 'showback', startDate, endDate, {
      providerId,
      accountId,
      teamName,
      productName
    })
    
    // Save report record
    const report = await saveReport(userId, {
      reportType: 'showback',
      reportName,
      startDate,
      endDate,
      providerId,
      accountId,
      teamName,
      productName,
      reportData,
      status: 'generating'
    })
    
    // Generate file asynchronously
    generateReportFile(report.id, reportData, format, userId)
      .then(filePath => {
        updateReportStatus(userId, report.id, 'completed', filePath)
      })
      .catch(error => {
        console.error('Report generation error:', error)
        updateReportStatus(userId, report.id, 'failed')
      })
    
    res.status(201).json({ 
      report: {
        ...report,
        status: 'generating'
      },
      message: 'Report generation started'
    })
  } catch (error) {
    console.error('Generate showback report error:', error)
    res.status(500).json({ error: 'Failed to generate showback report' })
  }
})

/**
 * POST /api/reports/chargeback
 * Generate a chargeback report
 */
router.post('/chargeback', async (req, res) => {
  try {
    const userId = req.user.id
    const { reportName, startDate, endDate, providerId, accountId, teamName, productName, format = 'csv' } = req.body
    
    if (!reportName || !startDate || !endDate) {
      return res.status(400).json({ error: 'reportName, startDate, and endDate are required' })
    }
    
    if (!['csv', 'pdf'].includes(format)) {
      return res.status(400).json({ error: 'format must be csv or pdf' })
    }
    
    // Generate report data
    const reportData = await generateReportData(userId, 'chargeback', startDate, endDate, {
      providerId,
      accountId,
      teamName,
      productName
    })
    
    // Save report record
    const report = await saveReport(userId, {
      reportType: 'chargeback',
      reportName,
      startDate,
      endDate,
      providerId,
      accountId,
      teamName,
      productName,
      reportData,
      status: 'generating'
    })
    
    // Generate file asynchronously
    generateReportFile(report.id, reportData, format, userId)
      .then(filePath => {
        updateReportStatus(userId, report.id, 'completed', filePath)
      })
      .catch(error => {
        console.error('Report generation error:', error)
        updateReportStatus(userId, report.id, 'failed')
      })
    
    res.status(201).json({ 
      report: {
        ...report,
        status: 'generating'
      },
      message: 'Report generation started'
    })
  } catch (error) {
    console.error('Generate chargeback report error:', error)
    res.status(500).json({ error: 'Failed to generate chargeback report' })
  }
})

/**
 * GET /api/reports
 * Get all reports for the user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id
    const { reportType, limit } = req.query
    
    const reports = await getReports(
      userId,
      reportType || null,
      limit ? parseInt(limit) : 50
    )
    
    res.json({ reports })
  } catch (error) {
    console.error('Get reports error:', error)
    res.status(500).json({ error: 'Failed to fetch reports' })
  }
})

/**
 * GET /api/reports/:reportId
 * Get a specific report
 */
router.get('/:reportId', async (req, res) => {
  try {
    const userId = req.user.id
    const reportId = parseInt(req.params.reportId)
    
    if (isNaN(reportId)) {
      return res.status(400).json({ error: 'Invalid report ID' })
    }
    
    const report = await getReport(userId, reportId)
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' })
    }
    
    res.json({ report })
  } catch (error) {
    console.error('Get report error:', error)
    res.status(500).json({ error: 'Failed to fetch report' })
  }
})

/**
 * GET /api/reports/:reportId/download
 * Download a report file
 */
router.get('/:reportId/download', async (req, res) => {
  try {
    const userId = req.user.id
    const reportId = parseInt(req.params.reportId)
    
    if (isNaN(reportId)) {
      return res.status(400).json({ error: 'Invalid report ID' })
    }
    
    const report = await getReport(userId, reportId)
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' })
    }
    
    if (report.status !== 'completed' || !report.filePath) {
      return res.status(400).json({ error: 'Report not ready for download' })
    }
    
    // Check if file exists
    try {
      await fs.access(report.filePath)
    } catch {
      return res.status(404).json({ error: 'Report file not found' })
    }
    
    const fileName = `${report.reportName}.${report.fileFormat}`
    res.download(report.filePath, fileName)
  } catch (error) {
    console.error('Download report error:', error)
    res.status(500).json({ error: 'Failed to download report' })
  }
})

/**
 * DELETE /api/reports/:reportId
 * Delete a report
 */
router.delete('/:reportId', async (req, res) => {
  try {
    const userId = req.user.id
    const reportId = parseInt(req.params.reportId)
    
    if (isNaN(reportId)) {
      return res.status(400).json({ error: 'Invalid report ID' })
    }
    
    const report = await getReport(userId, reportId)
    if (report && report.filePath) {
      // Delete file if it exists
      try {
        await fs.unlink(report.filePath)
      } catch (error) {
        console.error('Failed to delete report file:', error)
      }
    }
    
    const deleted = await deleteReport(userId, reportId)
    
    if (!deleted) {
      return res.status(404).json({ error: 'Report not found' })
    }
    
    res.json({ message: 'Report deleted successfully' })
  } catch (error) {
    console.error('Delete report error:', error)
    res.status(500).json({ error: 'Failed to delete report' })
  }
})

/**
 * Helper function to generate report file
 */
async function generateReportFile(reportId, reportData, format, userId) {
  const reportsDir = path.join(process.cwd(), 'reports', userId.toString())
  try {
    await fs.mkdir(reportsDir, { recursive: true })
  } catch (error) {
    console.error('Failed to create reports directory:', error)
    throw error
  }
  
  const fileName = `report_${reportId}_${Date.now()}.${format}`
  const filePath = path.join(reportsDir, fileName)
  
  if (format === 'csv') {
    await generateCSVReport(reportData, filePath)
  } else {
    await generatePDFReport(reportData, filePath)
  }
  
  return filePath
}

export default router
