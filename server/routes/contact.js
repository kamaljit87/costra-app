import express from 'express'
import rateLimit from 'express-rate-limit'
import { createContactSubmission } from '../database.js'
import logger from '../utils/logger.js'

const router = express.Router()

// Rate limit contact form: 5 submissions per hour per IP
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many contact submissions. Please try again later.',
    code: 'CONTACT_RATE_LIMIT',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

const sanitize = (str) => {
  if (!str) return ''
  return String(str).replace(/[<>]/g, '').trim()
}

const ALLOWED_CATEGORIES = ['bug_report', 'help', 'feature_request', 'other']

/**
 * POST /api/contact
 * Submit a contact form (public, no auth required)
 */
router.post('/', contactLimiter, async (req, res) => {
  try {
    const { name, email, category, subject, message } = req.body

    // Validate required fields
    if (!name || !email || !category || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required: name, email, category, subject, message' })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' })
    }

    // Validate category
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' })
    }

    // Validate lengths
    if (name.length > 200 || email.length > 320 || subject.length > 500 || message.length > 5000) {
      return res.status(400).json({ error: 'Field exceeds maximum length' })
    }

    // Sanitize inputs
    const sanitizedData = {
      name: sanitize(name).slice(0, 200),
      email: sanitize(email).slice(0, 320),
      category,
      subject: sanitize(subject).slice(0, 500),
      message: sanitize(message).slice(0, 5000),
      userId: req.user?.userId || req.user?.id || null,
      ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
      userAgent: (req.headers['user-agent'] || '').slice(0, 500),
    }

    const submission = await createContactSubmission(sanitizedData)

    logger.info('Contact form submitted', {
      id: submission.id,
      category: sanitizedData.category,
      email: sanitizedData.email,
    })

    // Send email notification to support (if email service is configured)
    try {
      const { sendEmail } = await import('../services/emailService.js')
      const supportEmail = process.env.SUPPORT_EMAIL
      if (supportEmail && sendEmail) {
        await sendEmail(null, {
          to: supportEmail,
          subject: `[Costra Contact] ${sanitizedData.category}: ${sanitizedData.subject}`,
          html: `
            <h3>New Contact Form Submission</h3>
            <p><strong>From:</strong> ${sanitizedData.name} (${sanitizedData.email})</p>
            <p><strong>Category:</strong> ${sanitizedData.category}</p>
            <p><strong>Subject:</strong> ${sanitizedData.subject}</p>
            <hr/>
            <p>${sanitizedData.message.replace(/\n/g, '<br/>')}</p>
          `,
          text: `New Contact: ${sanitizedData.category} - ${sanitizedData.subject}\nFrom: ${sanitizedData.name} (${sanitizedData.email})\n\n${sanitizedData.message}`,
        })
      }
    } catch (emailError) {
      // Don't fail the submission if email fails
      logger.warn('Failed to send contact notification email', { error: emailError.message })
    }

    res.status(201).json({
      message: 'Your message has been submitted successfully. We will get back to you soon.',
      id: submission.id,
    })
  } catch (error) {
    logger.error('Contact form error', {
      error: error.message,
      stack: error.stack,
    })
    res.status(500).json({ error: 'Failed to submit contact form. Please try again.' })
  }
})

export default router
