import logger from './logger.js'

/**
 * Validate JWT secret strength
 * Minimum 32 characters recommended for production
 */
export const validateJWTSecret = () => {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    logger.error('JWT_SECRET is not set')
    return false
  }

  if (jwtSecret.length < 32) {
    logger.warn('JWT_SECRET is less than 32 characters - consider using a stronger secret for production', {
      length: jwtSecret.length,
    })
    return false
  }

  // Check for common weak secrets
  const weakSecrets = ['secret', 'password', '123456', 'admin', 'test']
  const lowerSecret = jwtSecret.toLowerCase()
  if (weakSecrets.some(weak => lowerSecret.includes(weak))) {
    logger.warn('JWT_SECRET may be too weak - avoid common words', {
      length: jwtSecret.length,
    })
    return false
  }

  logger.info('JWT_SECRET strength validated', { length: jwtSecret.length })
  return true
}

/**
 * Check for potential hardcoded secrets in environment variables
 */
export const checkForHardcodedSecrets = () => {
  const sensitiveVars = [
    'JWT_SECRET',
    'DATABASE_URL',
    'SENTRY_DSN',
    'ANTHROPIC_API_KEY',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
  ]

  const issues = []
  sensitiveVars.forEach((varName) => {
    const value = process.env[varName]
    if (value) {
      // Check for common placeholder values
      const placeholders = ['your-secret', 'your-key', 'placeholder', 'change-me', 'example']
      const lowerValue = value.toLowerCase()
      if (placeholders.some(placeholder => lowerValue.includes(placeholder))) {
        issues.push({
          variable: varName,
          issue: 'Contains placeholder value',
        })
      }
    }
  })

  if (issues.length > 0) {
    logger.warn('Potential hardcoded secrets detected', { issues })
    return false
  }

  return true
}

/**
 * Validate environment configuration
 */
export const validateEnvironmentConfig = () => {
  const requiredVars = ['JWT_SECRET', 'DATABASE_URL']
  const missing = []

  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      missing.push(varName)
    }
  })

  if (missing.length > 0) {
    logger.error('Missing required environment variables', { missing })
    return false
  }

  // Validate DATABASE_URL format
  if (process.env.DATABASE_URL) {
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
      logger.warn('DATABASE_URL may have incorrect format', {
        format: dbUrl.substring(0, 20) + '...',
      })
    }
  }

  // Validate FRONTEND_URL format (if set)
  if (process.env.FRONTEND_URL) {
    const frontendUrl = process.env.FRONTEND_URL
    if (!frontendUrl.startsWith('http://') && !frontendUrl.startsWith('https://')) {
      logger.warn('FRONTEND_URL should start with http:// or https://', {
        url: frontendUrl,
      })
    }
  }

  logger.info('Environment configuration validated')
  return true
}

/**
 * Run comprehensive security audit
 */
export const runSecurityAudit = () => {
  logger.info('Starting security audit...')
  
  const results = {
    jwtSecret: validateJWTSecret(),
    hardcodedSecrets: checkForHardcodedSecrets(),
    environmentConfig: validateEnvironmentConfig(),
  }

  const allPassed = Object.values(results).every(result => result === true)

  if (allPassed) {
    logger.info('Security audit passed', { results })
  } else {
    logger.warn('Security audit found issues', { results })
  }

  return results
}

export default {
  validateJWTSecret,
  checkForHardcodedSecrets,
  validateEnvironmentConfig,
  runSecurityAudit,
}
