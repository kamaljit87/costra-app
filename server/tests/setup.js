/**
 * Test setup and teardown
 * Day 6: Testing Infrastructure
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../.env.test') })

// Set test environment
process.env.NODE_ENV = 'test'

// Use test database if specified
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
} else if (process.env.TEST_USE_COSTRA_TEST === 'true') {
  // Use separate costra_test database (requires: createdb costra_test)
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/costra'
  process.env.DATABASE_URL = dbUrl.replace(/\/[^/]+$/, '/costra_test')
} else {
  // Default: use main costra database (postgresql://postgres:postgres@localhost:5432/costra)
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/costra'
}

// Disable Redis for tests unless explicitly enabled
if (!process.env.TEST_REDIS_URL) {
  process.env.REDIS_URL = ''
}

// Set shorter timeouts for tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-jwt-tokens-min-32-chars'
process.env.SENTRY_DSN = '' // Disable Sentry in tests

// Note: jest is available globally in Jest test environment
if (typeof jest !== 'undefined') {
  jest.setTimeout(15000)
}
