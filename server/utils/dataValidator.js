import logger from './logger.js'

/**
 * Validate and sanitize cost data from API responses
 */

/**
 * Validate a number is a valid cost value
 */
export const validateCostValue = (value, fieldName = 'cost') => {
  if (value === null || value === undefined) {
    return null // Return null for missing values (will be handled as "N/A")
  }

  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num)) {
    logger.warn(`Invalid ${fieldName} value: ${value}`, { value, fieldName })
    return null
  }

  // Allow negative values for credits/refunds
  // But flag extremely large values as potential outliers
  if (Math.abs(num) > 1000000000) { // $1 billion
    logger.warn(`Unusually large ${fieldName} value detected`, { value: num, fieldName })
    // Still return it, but log a warning
  }

  return num
}

/**
 * Validate date string is ISO 8601 format
 */
export const validateDate = (dateString, fieldName = 'date') => {
  if (!dateString) {
    return null
  }

  const date = new Date(dateString)
  if (isNaN(date.getTime())) {
    logger.warn(`Invalid ${fieldName} format: ${dateString}`, { dateString, fieldName })
    return null
  }

  return dateString // Return as-is if valid
}

/**
 * Validate service name
 */
export const validateServiceName = (name) => {
  if (!name || typeof name !== 'string') {
    return null
  }

  // Trim and limit length
  const sanitized = name.trim().substring(0, 200)
  if (sanitized.length === 0) {
    return null
  }

  return sanitized
}

/**
 * Validate API response structure
 */
export const validateCostDataResponse = (data) => {
  const errors = []

  // Check required fields
  if (typeof data.currentMonth !== 'number' && data.currentMonth !== null && data.currentMonth !== undefined) {
    errors.push('currentMonth must be a number or null')
  }

  // Validate dailyData if present
  if (data.dailyData && Array.isArray(data.dailyData)) {
    data.dailyData.forEach((day, index) => {
      if (!day.date) {
        errors.push(`dailyData[${index}] missing date`)
      } else if (!validateDate(day.date)) {
        errors.push(`dailyData[${index}] has invalid date: ${day.date}`)
      }

      const cost = validateCostValue(day.cost, `dailyData[${index}].cost`)
      if (cost === null && day.cost !== null && day.cost !== undefined) {
        errors.push(`dailyData[${index}] has invalid cost: ${day.cost}`)
      }
    })
  }

  // Validate services if present
  if (data.services && Array.isArray(data.services)) {
    data.services.forEach((service, index) => {
      if (!service.name) {
        errors.push(`services[${index}] missing name`)
      }

      const cost = validateCostValue(service.cost, `services[${index}].cost`)
      if (cost === null && service.cost !== null && service.cost !== undefined) {
        errors.push(`services[${index}] has invalid cost: ${service.cost}`)
      }
    })
  }

  if (errors.length > 0) {
    logger.warn('Cost data validation errors', { errors, dataKeys: Object.keys(data) })
    return { valid: false, errors }
  }

  return { valid: true, errors: [] }
}

/**
 * Sanitize cost data before saving
 */
export const sanitizeCostData = (data) => {
  const sanitized = {
    currentMonth: validateCostValue(data.currentMonth, 'currentMonth'),
    lastMonth: data.lastMonth !== undefined ? validateCostValue(data.lastMonth, 'lastMonth') : null,
    forecast: data.forecast !== undefined ? validateCostValue(data.forecast, 'forecast') : null,
    credits: validateCostValue(data.credits || 0, 'credits'),
    savings: validateCostValue(data.savings || 0, 'savings'),
    services: [],
    dailyData: [],
  }

  // Sanitize services
  if (data.services && Array.isArray(data.services)) {
    sanitized.services = data.services
      .map((service) => {
        const name = validateServiceName(service.name || service.serviceName)
        const cost = validateCostValue(service.cost, 'service.cost')
        if (!name || cost === null) {
          return null
        }
        return {
          name,
          cost,
          change: validateCostValue(service.change || 0, 'service.change') || 0,
        }
      })
      .filter((service) => service !== null)
  }

  // Sanitize daily data
  if (data.dailyData && Array.isArray(data.dailyData)) {
    sanitized.dailyData = data.dailyData
      .map((day) => {
        const date = validateDate(day.date)
        const cost = validateCostValue(day.cost, 'dailyData.cost')
        if (!date || cost === null) {
          return null
        }
        return { date, cost }
      })
      .filter((day) => day !== null)
  }

  return sanitized
}

/**
 * Check for data outliers (values that seem unreasonable)
 */
export const detectOutliers = (values) => {
  if (!values || values.length === 0) return []

  const numbers = values.filter((v) => typeof v === 'number' && !isNaN(v))
  if (numbers.length === 0) return []

  // Calculate mean and standard deviation
  const mean = numbers.reduce((sum, val) => sum + val, 0) / numbers.length
  const variance = numbers.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / numbers.length
  const stdDev = Math.sqrt(variance)

  // Flag values more than 3 standard deviations from mean
  const threshold = mean + 3 * stdDev
  const outliers = numbers.filter((val) => Math.abs(val - mean) > threshold)

  if (outliers.length > 0) {
    logger.warn('Data outliers detected', {
      mean: mean.toFixed(2),
      stdDev: stdDev.toFixed(2),
      threshold: threshold.toFixed(2),
      outlierCount: outliers.length,
      outliers: outliers.slice(0, 5), // Log first 5
    })
  }

  return outliers
}

export default {
  validateCostValue,
  validateDate,
  validateServiceName,
  validateCostDataResponse,
  sanitizeCostData,
  detectOutliers,
}
