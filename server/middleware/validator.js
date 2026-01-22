import { body, query, param, validationResult } from 'express-validator'
import { AppError } from './errorHandler.js'

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }))
    
    throw new AppError(
      'Validation failed',
      400,
      'VALIDATION_ERROR',
      { errors: errorMessages }
    )
  }
  next()
}

/**
 * Sanitize string input to prevent XSS
 */
export const sanitizeString = (str) => {
  if (typeof str !== 'string') return str
  return str
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
}

/**
 * Validation rules for authentication endpoints
 */
export const validateSignup = [
  body('email')
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters')
    .customSanitizer(sanitizeString),
  handleValidationErrors,
]

export const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors,
]

/**
 * Validation rules for cost data endpoints
 */
export const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate must be a valid ISO 8601 date'),
  query('providerId')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('providerId must be between 1 and 50 characters')
    .customSanitizer(sanitizeString),
  query('accountId')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('accountId must be between 1 and 100 characters')
    .customSanitizer(sanitizeString),
  handleValidationErrors,
]

/**
 * Validation rules for cloud provider endpoints
 */
export const validateProviderId = [
  param('id')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Provider ID must be between 1 and 50 characters')
    .customSanitizer(sanitizeString),
  handleValidationErrors,
]

export const validateProviderCredentials = [
  body('providerId')
    .trim()
    .isIn(['aws', 'azure', 'gcp', 'digitalocean', 'ibm', 'linode', 'vultr'])
    .withMessage('Invalid provider ID')
    .customSanitizer(sanitizeString),
  body('connectionName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Connection name must be between 1 and 100 characters')
    .customSanitizer(sanitizeString),
  handleValidationErrors,
]

/**
 * Validation rules for budget endpoints
 */
export const validateBudget = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Budget name must be between 1 and 100 characters')
    .customSanitizer(sanitizeString),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Budget amount must be a positive number'),
  body('period')
    .isIn(['monthly', 'quarterly', 'yearly'])
    .withMessage('Period must be monthly, quarterly, or yearly'),
  body('providerId')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Provider ID must be between 1 and 50 characters')
    .customSanitizer(sanitizeString),
  body('accountId')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Account ID must be between 1 and 100 characters')
    .customSanitizer(sanitizeString),
  handleValidationErrors,
]

/**
 * Validation rules for AI endpoints
 */
export const validateAIChat = [
  body('message')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message must be between 1 and 5000 characters')
    .customSanitizer(sanitizeString),
  handleValidationErrors,
]

/**
 * Validation rules for profile endpoints
 */
export const validateProfileUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters')
    .customSanitizer(sanitizeString),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail(),
  body('currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'SGD'])
    .withMessage('Invalid currency code'),
  handleValidationErrors,
]

export const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
  handleValidationErrors,
]

/**
 * Validation rules for report endpoints
 */
export const validateReport = [
  body('reportType')
    .isIn(['showback', 'chargeback'])
    .withMessage('Report type must be showback or chargeback'),
  body('startDate')
    .isISO8601()
    .withMessage('startDate must be a valid ISO 8601 date'),
  body('endDate')
    .isISO8601()
    .withMessage('endDate must be a valid ISO 8601 date'),
  body('providerId')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Provider ID must be between 1 and 50 characters')
    .customSanitizer(sanitizeString),
  handleValidationErrors,
]

export default {
  handleValidationErrors,
  sanitizeString,
  validateSignup,
  validateLogin,
  validateDateRange,
  validateProviderId,
  validateProviderCredentials,
  validateBudget,
  validateAIChat,
  validateProfileUpdate,
  validatePasswordChange,
  validateReport,
}
