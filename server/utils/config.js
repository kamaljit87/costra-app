/**
 * Configuration validation utility
 */

import logger from './logger.js'

/**
 * Required environment variables
 */
const REQUIRED_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
]

/**
 * Additional required vars in production
 */
const PRODUCTION_REQUIRED_VARS = [
  'ENCRYPTION_KEY',
  'FRONTEND_URL',
]

/**
 * Validate environment variables
 */
export const validateConfig = () => {
  const errors = []
  const warnings = []
  const isProduction = process.env.NODE_ENV === 'production'
  const isTest = process.env.NODE_ENV === 'test'

  if (isTest) return // Skip validation in test (setup provides env)

  // Check required variables
  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`)
    }
  }

  // Check production-only required variables
  if (isProduction) {
    for (const varName of PRODUCTION_REQUIRED_VARS) {
      if (!process.env[varName]) {
        errors.push(`Missing required environment variable for production: ${varName}`)
      }
    }
  }

  // Validate DATABASE_URL format
  if (process.env.DATABASE_URL) {
    const dbUrlPattern = /^postgresql:\/\//
    if (!dbUrlPattern.test(process.env.DATABASE_URL)) {
      errors.push('DATABASE_URL must be a valid PostgreSQL connection string (postgresql://...)')
    }
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long')
    }
    if (process.env.JWT_SECRET === 'your-secret-key-change-this-in-production-min-32-chars' ||
        process.env.JWT_SECRET === 'CHANGE_ME_TO_A_SECURE_RANDOM_SECRET') {
      if (isProduction) {
        errors.push('JWT_SECRET is using a default/placeholder value - set a real secret for production')
      } else {
        warnings.push('JWT_SECRET is using the default value - change it before deploying to production')
      }
    }
  }

  // Validate ENCRYPTION_KEY strength in production
  if (isProduction && process.env.ENCRYPTION_KEY) {
    if (process.env.ENCRYPTION_KEY.length < 32) {
      errors.push('ENCRYPTION_KEY must be at least 32 characters long in production')
    }
  }

  // Validate ANTHROPIC_API_KEY is not a placeholder
  if (process.env.ANTHROPIC_API_KEY) {
    if (process.env.ANTHROPIC_API_KEY.startsWith('CHANGE_ME') ||
        process.env.ANTHROPIC_API_KEY === 'sk-ant-placeholder') {
      if (isProduction) {
        errors.push('ANTHROPIC_API_KEY is set to a placeholder value - set a real key or remove it')
      } else {
        warnings.push('ANTHROPIC_API_KEY appears to be a placeholder - AI features will not work')
      }
    }
  }

  // Validate FRONTEND_URL format
  if (process.env.FRONTEND_URL) {
    try {
      new URL(process.env.FRONTEND_URL)
    } catch (error) {
      errors.push(`FRONTEND_URL is not a valid URL: ${process.env.FRONTEND_URL}`)
    }
  }

  // Validate GOOGLE_CLIENT_ID presence if Google OAuth secret is set
  if (isProduction && process.env.GOOGLE_CLIENT_SECRET && !process.env.GOOGLE_CLIENT_ID) {
    errors.push('GOOGLE_CLIENT_SECRET is set but GOOGLE_CLIENT_ID is missing')
  }

  // Validate PORT
  if (process.env.PORT) {
    const port = parseInt(process.env.PORT, 10)
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push(`PORT must be a valid number between 1 and 65535, got: ${process.env.PORT}`)
    }
  }

  // Validate NODE_ENV
  const validEnvs = ['development', 'production', 'test']
  if (process.env.NODE_ENV && !validEnvs.includes(process.env.NODE_ENV)) {
    warnings.push(`NODE_ENV should be one of: ${validEnvs.join(', ')}, got: ${process.env.NODE_ENV}`)
  }

  // Validate Redis URL format (if provided)
  if (process.env.REDIS_URL) {
    const redisUrlPattern = /^redis(s)?:\/\//
    if (!redisUrlPattern.test(process.env.REDIS_URL)) {
      warnings.push('REDIS_URL format may be invalid (should start with redis:// or rediss://)')
    }
  }

  // Validate AWS credentials (if provided)
  if (process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_SECRET_ACCESS_KEY) {
    warnings.push('AWS_ACCESS_KEY_ID is set but AWS_SECRET_ACCESS_KEY is missing')
  }
  if (process.env.AWS_SECRET_ACCESS_KEY && !process.env.AWS_ACCESS_KEY_ID) {
    warnings.push('AWS_SECRET_ACCESS_KEY is set but AWS_ACCESS_KEY_ID is missing')
  }

  // Log warnings
  if (warnings.length > 0) {
    logger.warn('Configuration warnings:', { warnings })
  }

  // Log errors and exit if critical
  if (errors.length > 0) {
    logger.error('Configuration validation failed:', { errors })
    console.error('\nConfiguration Errors:')
    errors.forEach((error) => console.error(`  - ${error}`))
    console.error('\nPlease fix these errors and restart the server.\n')
    process.exit(1)
  }

  // Log success
  if (errors.length === 0 && warnings.length === 0) {
    logger.info('Configuration validated successfully')
  }
}

/**
 * Get configuration summary (for health check)
 */
export const getConfigSummary = () => {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3001,
    hasDatabase: !!process.env.DATABASE_URL,
    hasRedis: !!process.env.REDIS_URL,
    hasSentry: !!process.env.SENTRY_DSN,
    hasGoogleAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    hasAwsCredentials: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
    hasEncryptionKey: !!process.env.ENCRYPTION_KEY,
    jwtSecretLength: process.env.JWT_SECRET?.length || 0,
  }
}
