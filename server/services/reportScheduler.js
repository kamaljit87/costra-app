/**
 * Report Scheduler Service
 * Runs scheduled reports and emails them to recipients
 */

import cron from 'node-cron'
import logger from '../utils/logger.js'
import {
  getDueReportSchedules,
  updateLastRunAt,
  generateReportData,
  saveReport,
  updateReportStatus,
} from '../database.js'
import { generateCSVReport, generatePDFReport } from '../utils/reportGenerator.js'
import { isEmailServiceAvailable } from './emailService.js'
import path from 'path'
import fs from 'fs/promises'
import nodemailer from 'nodemailer'

export const runScheduledReports = async () => {
  try {
    logger.info('Running scheduled report delivery')
    const schedules = await getDueReportSchedules()
    logger.info('Due report schedules found', { count: schedules.length })

    for (const schedule of schedules) {
      try {
        await processScheduledReport(schedule)
        await updateLastRunAt(schedule.id, schedule.frequency, schedule.day_of_week, schedule.day_of_month)
      } catch (err) {
        logger.error('Failed to process scheduled report', { scheduleId: schedule.id, error: err.message })
      }
    }

    logger.info('Scheduled report delivery completed')
  } catch (error) {
    logger.error('Scheduled report delivery failed', { error: error.message, stack: error.stack })
  }
}

async function processScheduledReport(schedule) {
  const { user_id: userId, report_type: reportType, report_name: reportName, file_format: format, filters, recipients } = schedule
  const parsedFilters = typeof filters === 'string' ? JSON.parse(filters) : (filters || {})
  const parsedRecipients = typeof recipients === 'string' ? JSON.parse(recipients) : (recipients || [])

  // Calculate date range based on frequency
  const now = new Date()
  let startDate, endDate
  if (schedule.frequency === 'daily') {
    startDate = new Date(now)
    startDate.setDate(startDate.getDate() - 1)
    endDate = new Date(now)
  } else if (schedule.frequency === 'weekly') {
    startDate = new Date(now)
    startDate.setDate(startDate.getDate() - 7)
    endDate = new Date(now)
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    endDate = new Date(now.getFullYear(), now.getMonth(), 0)
  }

  const reportData = await generateReportData(userId, reportType || 'showback', startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0], parsedFilters)
  reportData.options = { reportName, ...parsedFilters }

  const report = await saveReport(userId, {
    reportType: reportType || 'showback',
    reportName: `${reportName} (Scheduled)`,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    reportData,
    fileFormat: format || 'pdf',
    status: 'generating',
  })

  // Generate file
  const reportsDir = path.join(process.cwd(), 'reports')
  await fs.mkdir(reportsDir, { recursive: true })
  const filePath = path.join(reportsDir, `report-${report.id}.${format || 'pdf'}`)

  if (format === 'csv') {
    await generateCSVReport(reportData, filePath)
  } else {
    await generatePDFReport(reportData, filePath)
  }

  await updateReportStatus(userId, report.id, 'completed', filePath)

  // Email to recipients
  if (parsedRecipients.length > 0 && isEmailServiceAvailable()) {
    try {
      const { getEmailTransporter } = await import('./emailService.js')
      const transporter = getEmailTransporter()
      if (transporter) {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || 'noreply@costra.io',
          to: parsedRecipients.join(', '),
          subject: `Costra Report: ${reportName}`,
          text: `Your scheduled report "${reportName}" is attached.\n\nPeriod: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
          attachments: [{ filename: path.basename(filePath), path: filePath }],
        })
        logger.info('Scheduled report emailed', { scheduleId: schedule.id, recipients: parsedRecipients.length })
      }
    } catch (emailErr) {
      logger.error('Failed to email scheduled report', { scheduleId: schedule.id, error: emailErr.message })
    }
  }
}

export const initReportScheduler = () => {
  // Run daily at 7 AM UTC
  cron.schedule('0 7 * * *', async () => {
    await runScheduledReports()
  })
  logger.info('Report scheduler cron initialized (daily at 7 AM UTC)')
}
