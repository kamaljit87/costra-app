import createCsvWriter from 'csv-writer'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import { promisify } from 'util'

const writeFile = promisify(fs.writeFile)
const createWriteStream = fs.createWriteStream

/**
 * Generate CSV report
 */
export async function generateCSVReport(reportData, filePath) {
  const csvWriter = createCsvWriter.createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'category', title: 'Category' },
      { id: 'name', title: 'Name' },
      { id: 'cost', title: 'Cost ($)' },
      { id: 'resourceCount', title: 'Resource Count' },
      { id: 'serviceCount', title: 'Service Count' }
    ]
  })
  
  const records = reportData.costData.map(item => ({
    category: item.category || item.serviceName ? 'Service' : (item.category || 'Other'),
    name: item.name || item.serviceName || 'N/A',
    cost: (item.cost || 0).toFixed(2),
    resourceCount: item.resourceCount || 0,
    serviceCount: item.serviceCount || 0
  }))
  
  await csvWriter.writeRecords(records)
  
  // Add summary row
  const summaryWriter = createCsvWriter.createObjectCsvWriter({
    path: filePath,
    append: true,
    header: [
      { id: 'category', title: 'Category' },
      { id: 'name', title: 'Name' },
      { id: 'cost', title: 'Cost ($)' },
      { id: 'resourceCount', title: 'Resource Count' },
      { id: 'serviceCount', title: 'Service Count' }
    ]
  })
  
  await summaryWriter.writeRecords([{
    category: 'SUMMARY',
    name: 'Total',
    cost: reportData.summary.totalCost.toFixed(2),
    resourceCount: reportData.summary.resourceCount,
    serviceCount: reportData.summary.serviceCount
  }])
}

/**
 * Generate PDF report
 */
export async function generatePDFReport(reportData, filePath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const stream = createWriteStream(filePath)
    
    doc.pipe(stream)
    
    // Header
    doc.fontSize(20).text(
      `${reportData.reportType === 'showback' ? 'Showback' : 'Chargeback'} Report`,
      { align: 'center' }
    )
    doc.moveDown()
    
    // Report info
    doc.fontSize(12)
    const reportName = reportData.options?.reportName || 'Untitled'
    doc.text(`Report Name: ${reportName}`)
    doc.text(`Period: ${reportData.summary.period.startDate} to ${reportData.summary.period.endDate}`)
    if (reportData.options?.providerId) {
      doc.text(`Provider: ${reportData.options.providerId.toUpperCase()}`)
    }
    if (reportData.options?.teamName) {
      doc.text(`Team: ${reportData.options.teamName}`)
    }
    if (reportData.options?.productName) {
      doc.text(`Product: ${reportData.options.productName}`)
    }
    doc.moveDown()
    
    // Summary
    doc.fontSize(16).text('Summary', { underline: true })
    doc.fontSize(12)
    doc.text(`Total Cost: $${reportData.summary.totalCost.toFixed(2)}`)
    doc.text(`Total Resources: ${reportData.summary.resourceCount}`)
    doc.text(`Total Services: ${reportData.summary.serviceCount}`)
    doc.moveDown()
    
    // Cost breakdown
    if (reportData.costData.length > 0) {
      doc.fontSize(16).text('Cost Breakdown', { underline: true })
      doc.moveDown(0.5)
      
      // Table header
      doc.fontSize(10)
      const tableTop = doc.y
      doc.text('Category', 50, tableTop)
      doc.text('Name', 150, tableTop)
      doc.text('Cost ($)', 350, tableTop, { width: 100, align: 'right' })
      doc.text('Resources', 450, tableTop, { width: 80, align: 'right' })
      
      let y = tableTop + 20
      reportData.costData.slice(0, 50).forEach(item => {
        if (y > 700) {
          doc.addPage()
          y = 50
        }
        
        doc.text(item.category || 'Service', 50, y)
        doc.text(item.name || item.serviceName || 'N/A', 150, y, { width: 180 })
        doc.text(`$${(item.cost || 0).toFixed(2)}`, 350, y, { width: 100, align: 'right' })
        doc.text((item.resourceCount || 0).toString(), 450, y, { width: 80, align: 'right' })
        y += 15
      })
    }
    
    // Footer
    doc.fontSize(8)
    doc.text(
      `Generated on ${new Date(reportData.generatedAt).toLocaleString()}`,
      50,
      doc.page.height - 50,
      { align: 'center' }
    )
    
    doc.end()
    
    stream.on('finish', () => resolve())
    stream.on('error', reject)
  })
}
