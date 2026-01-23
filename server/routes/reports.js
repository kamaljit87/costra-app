import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { requireFeature } from '../middleware/featureGate.js'
import logger from '../utils/logger.js'
import {
  generateReportData,
  saveReport,
  getReports,
  getReport,
  updateReportStatus,
  deleteReport,
  createNotification,
} from '../database.js'
import { generateCSVReport, generatePDFReport } from '../utils/reportGenerator.js'
import { parsePagination, createPaginationMeta, createPaginatedResponse } from '../utils/pagination.js'
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
    const userId = req.user.userId || req.user.id
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' })
    }
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
    
    // Add report options to reportData for generator
    reportData.options = {
      reportName,
      providerId,
      accountId,
      teamName,
      productName
    }
    
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
      fileFormat: format,
      status: 'generating'
    })
    
    // Generate file asynchronously
    generateReportFile(report.id, reportData, format, userId)
      .then(async (filePath) => {
        await updateReportStatus(userId, report.id, 'completed', filePath)
        
        // Create notification for successful report generation
        try {
          await createNotification(userId, {
            type: 'success',
            title: 'Report Generated',
            message: `Your Cost Visibility report "${reportName}" is ready for download`,
            link: '/reports',
            linkText: 'View Reports',
            metadata: {
              reportId: report.id,
              reportName,
              reportType: 'showback',
              format
            }
          })
        } catch (notifError) {
          logger.error('Reports: Failed to create notification', { 
            userId, 
            error: notifError.message 
          })
        }
      })
      .catch(async (error) => {
        logger.error('Report generation error', { 
          userId, 
          reportId: report.id, 
          error: error.message, 
          stack: error.stack 
        })
        await updateReportStatus(userId, report.id, 'failed')
        
        // Create notification for failed report generation
        try {
          await createNotification(userId, {
            type: 'warning',
            title: 'Report Generation Failed',
            message: `Failed to generate Cost Visibility report "${reportName}". Please try again.`,
            link: '/reports',
            linkText: 'View Reports',
            metadata: {
              reportId: report.id,
              reportName,
              reportType: 'showback',
              error: error.message
            }
          })
        } catch (notifError) {
          logger.error('Reports: Failed to create notification', { 
            userId, 
            error: notifError.message 
          })
        }
      })
    
    res.status(201).json({ 
      report: {
        ...report,
        status: 'generating'
      },
      message: 'Report generation started'
    })
  } catch (error) {
    logger.error('Generate showback report error', { 
      userId: req.user?.userId || req.user?.id, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to generate showback report' })
  }
})

/**
 * POST /api/reports/chargeback
 * Generate a chargeback report
 */
router.post('/chargeback', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' })
    }
    const { reportName, startDate, endDate, providerId, accountId, teamName, productName, format = 'csv' } = req.body
    
    if (!reportName || !startDate || !endDate) {
      return res.status(400).json({ error: 'reportName, startDate, and endDate are required' })
    }
    
    if (!['csv', 'pdf'].includes(format)) {
      return res.status(400).json({ error: 'format must be csv or pdf' })
    }
    
    // Check if CSV export is requested (Pro only)
    if (format === 'csv') {
      const { canAccessFeature } = await import('../services/subscriptionService.js')
      const hasAccess = await canAccessFeature(userId, 'csv_export')
      if (!hasAccess) {
        return res.status(403).json({
          error: 'Feature not available',
          message: 'CSV export requires a Pro subscription',
          feature: 'csv_export',
          requiredPlan: 'Pro',
          upgradeUrl: '/settings/billing',
        })
      }
    }
    
    // Generate report data
    const reportData = await generateReportData(userId, 'chargeback', startDate, endDate, {
      providerId,
      accountId,
      teamName,
      productName
    })
    
    // Add report options to reportData for generator
    reportData.options = {
      reportName,
      providerId,
      accountId,
      teamName,
      productName
    }
    
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
      fileFormat: format,
      status: 'generating'
    })
    
    // Generate file asynchronously
    generateReportFile(report.id, reportData, format, userId)
      .then(async (filePath) => {
        await updateReportStatus(userId, report.id, 'completed', filePath)
        
        // Create notification for successful report generation
        try {
          await createNotification(userId, {
            type: 'success',
            title: 'Report Generated',
            message: `Your Cost Allocation report "${reportName}" is ready for download`,
            link: '/reports',
            linkText: 'View Reports',
            metadata: {
              reportId: report.id,
              reportName,
              reportType: 'chargeback',
              format
            }
          })
        } catch (notifError) {
          logger.error('Reports: Failed to create notification', { 
            userId, 
            error: notifError.message 
          })
        }
      })
      .catch(async (error) => {
        logger.error('Report generation error', { 
          userId, 
          reportId: report.id, 
          error: error.message, 
          stack: error.stack 
        })
        await updateReportStatus(userId, report.id, 'failed')
        
        // Create notification for failed report generation
        try {
          await createNotification(userId, {
            type: 'warning',
            title: 'Report Generation Failed',
            message: `Failed to generate Cost Allocation report "${reportName}". Please try again.`,
            link: '/reports',
            linkText: 'View Reports',
            metadata: {
              reportId: report.id,
              reportName,
              reportType: 'chargeback',
              error: error.message
            }
          })
        } catch (notifError) {
          logger.error('Reports: Failed to create notification', { 
            userId, 
            error: notifError.message 
          })
        }
      })
    
    res.status(201).json({ 
      report: {
        ...report,
        status: 'generating'
      },
      message: 'Report generation started'
    })
  } catch (error) {
    logger.error('Generate chargeback report error', { 
      userId: req.user?.userId || req.user?.id, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to generate chargeback report' })
  }
})

/**
 * GET /api/reports
 * Get all reports for the user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' })
    }
    const { reportType } = req.query
    
    // Parse pagination (default: 20 per page for reports)
    const { page, limit, offset } = parsePagination(req, { page: 1, limit: 20, maxLimit: 100 })
    
    const result = await getReports(
      userId,
      reportType || null,
      limit,
      offset,
      true // includeTotal
    )
    
    const reports = result.reports || result
    const total = result.total || reports.length
    
    // Create pagination metadata
    const pagination = createPaginationMeta(page, limit, total)
    
    // Return paginated response
    res.json(createPaginatedResponse(reports, pagination))
  } catch (error) {
    logger.error('Get reports error', { 
      userId: req.user?.userId || req.user?.id, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to fetch reports' })
  }
})

/**
 * GET /api/reports/:reportId
 * Get a specific report
 */
router.get('/:reportId', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' })
    }
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
    logger.error('Get report error', { 
      userId: req.user?.userId || req.user?.id, 
      reportId: req.params.id, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to fetch report' })
  }
})

/**
 * GET /api/reports/:reportId/download
 * Download a report file
 */
router.get('/:reportId/download', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' })
    }
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
    
    // Determine file extension from fileFormat or extract from filePath
    const fileExtension = report.fileFormat || path.extname(report.filePath).slice(1) || 'csv'
    const fileName = `${report.reportName}.${fileExtension}`
    
    // Set appropriate content type
    if (fileExtension === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf')
    } else {
      res.setHeader('Content-Type', 'text/csv')
    }
    
    res.download(report.filePath, fileName)
  } catch (error) {
    logger.error('Download report error', { 
      userId: req.user?.userId || req.user?.id, 
      reportId: req.params.id, 
      error: error.message, 
      stack: error.stack 
    })
    res.status(500).json({ error: 'Failed to download report' })
  }
})

/**
 * DELETE /api/reports/:reportId
 * Delete a report
 */
router.delete('/:reportId', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found' })
    }
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
        logger.error('Failed to delete report file', { 
          userId, 
          reportId, 
          filePath, 
          error: error.message 
        })
      }
    }
    
    const deleted = await deleteReport(userId, reportId)
    
    if (!deleted) {
      return res.status(404).json({ error: 'Report not found' })
    }
    
    res.json({ message: 'Report deleted successfully' })
  } catch (error) {
    logger.error('Delete report error', { 
      userId: req.user?.userId || req.user?.id, 
      reportId: req.params.id, 
      error: error.message, 
      stack: error.stack 
    })
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
    logger.error('Failed to create reports directory', { 
      reportsDir, 
      error: error.message, 
      stack: error.stack 
    })
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
