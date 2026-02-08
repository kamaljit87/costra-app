import crypto from 'node:crypto'
import logger from '../utils/logger.js'

// Get encryption key from environment
// In production, ENCRYPTION_KEY must be set — refuse to start with a default key
let ENCRYPTION_KEY
if (process.env.ENCRYPTION_KEY) {
  ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex').length === 32
    ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
    : crypto.scryptSync(process.env.ENCRYPTION_KEY, 'costra-encryption-salt', 32)
} else if (process.env.NODE_ENV === 'production') {
  logger.error('ENCRYPTION_KEY environment variable is required in production. Cloud provider credentials cannot be securely stored without it.')
  process.exit(1)
} else {
  logger.warn('Using default encryption key — NOT SAFE FOR PRODUCTION. Set ENCRYPTION_KEY environment variable.')
  ENCRYPTION_KEY = crypto.scryptSync('costra-dev-only-key', 'costra-encryption-salt', 32)
}
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Encrypt sensitive data (like cloud provider credentials)
 */
export const encrypt = (text) => {
  if (!text) return null
  
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  // Return IV + AuthTag + Encrypted data
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
}

/**
 * Decrypt sensitive data
 */
export const decrypt = (encryptedData) => {
  if (!encryptedData) return null
  
  try {
    const parts = encryptedData.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format')
    }
    
    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]
    
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    logger.error('Decryption error', { 
      error: error.message, 
      stack: error.stack 
    })
    throw new Error('Failed to decrypt data')
  }
}
