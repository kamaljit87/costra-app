import crypto from 'node:crypto'
import logger from '../utils/logger.js'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

// Lazy-initialized encryption key — resolved on first use so that
// dotenv.config() in server.js has time to load .env before we read
// process.env.ENCRYPTION_KEY.
let _encryptionKey = null

const getEncryptionKey = () => {
  if (_encryptionKey) return _encryptionKey

  if (process.env.ENCRYPTION_KEY) {
    const keyBuffer = Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
    if (keyBuffer.length === 32) {
      _encryptionKey = keyBuffer
    } else {
      const salt = process.env.ENCRYPTION_SALT || crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY).digest('hex').slice(0, 32)
      _encryptionKey = crypto.scryptSync(process.env.ENCRYPTION_KEY, salt, 32)
    }
  } else if (process.env.NODE_ENV === 'production') {
    logger.error('ENCRYPTION_KEY environment variable is required in production. Cloud provider credentials cannot be securely stored without it.')
    process.exit(1)
  } else {
    logger.warn('Using default encryption key — NOT SAFE FOR PRODUCTION. Set ENCRYPTION_KEY environment variable.')
    _encryptionKey = crypto.scryptSync('costra-default-key-change-in-production', 'costra-dev-salt-not-for-production', 32)
  }

  return _encryptionKey
}

/**
 * Encrypt sensitive data (like cloud provider credentials)
 */
export const encrypt = (text) => {
  if (!text) return null
  
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  // Return IV + AuthTag + Encrypted data
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
}

/**
 * Low-level decrypt with a specific key
 */
const decryptWithKey = (encryptedData, key) => {
  const parts = encryptedData.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format')
  }

  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

// Legacy default key used when ENCRYPTION_KEY env var was not loaded at import time
const LEGACY_KEY = crypto.scryptSync('costra-default-key-change-in-production', 'costra-dev-salt-not-for-production', 32)

/**
 * Decrypt sensitive data
 * Tries the current key first, then falls back to the legacy default key
 * for credentials that were encrypted before the lazy-init fix.
 */
export const decrypt = (encryptedData) => {
  if (!encryptedData) return null

  // Try current key first
  try {
    return decryptWithKey(encryptedData, getEncryptionKey())
  } catch (_primaryErr) {
    // Current key failed — try legacy default key
  }

  try {
    const decrypted = decryptWithKey(encryptedData, LEGACY_KEY)
    logger.info('Decrypted with legacy key — credentials should be re-saved to use current key')
    return decrypted
  } catch (error) {
    logger.error('Decryption error (both current and legacy keys failed)', {
      error: error.message,
      stack: error.stack
    })
    throw new Error('Failed to decrypt data')
  }
}
