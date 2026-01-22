/**
 * Test utilities
 * Day 6: Testing Infrastructure
 */

import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import {
  createUser,
  getUserByEmail,
  deleteUser,
  pool,
} from '../database.js'

/**
 * Create a test user
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.password - User password (will be hashed)
 * @param {string} userData.name - User name
 * @returns {Promise<Object>} Created user
 */
export const createTestUser = async (userData = {}) => {
  const {
    email = `test-${Date.now()}@example.com`,
    password = 'TestPassword123!',
    name = 'Test User',
  } = userData

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await createUser(name, email, passwordHash)
  return { ...user, password } // Include plain password for testing
}

/**
 * Delete a test user
 * @param {number} userId - User ID
 */
export const deleteTestUser = async (userId) => {
  try {
    await deleteUser(userId)
  } catch (error) {
    // Ignore errors if user doesn't exist
    if (!error.message.includes('not found')) {
      throw error
    }
  }
}

/**
 * Generate a JWT token for testing
 * @param {Object} payload - Token payload
 * @param {number} payload.userId - User ID
 * @param {string} payload.email - User email
 * @returns {string} JWT token
 */
export const generateTestToken = (payload = {}) => {
  const {
    userId = 1,
    email = 'test@example.com',
  } = payload

  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET || 'test-secret-key-for-jwt-tokens-min-32-chars',
    { expiresIn: '1h' }
  )
}

/**
 * Clean up test database
 * @param {Array<string>} tables - Tables to clean (default: all)
 */
export const cleanupDatabase = async (tables = []) => {
  const client = await pool.connect()
  try {
    // Disable foreign key checks temporarily
    await client.query('SET session_replication_role = replica')

    const tablesToClean = tables.length > 0
      ? tables
      : [
          'notifications',
          'reports',
          'budget_alerts',
          'budgets',
          'cost_explanations_range',
          'cost_explanations',
          'anomaly_baselines',
          'service_usage_metrics',
          'resource_tags',
          'resources',
          'savings_plans',
          'service_costs',
          'daily_cost_data',
          'cost_data_cache',
          'cost_data',
          'cloud_provider_credentials',
          'user_preferences',
          'users',
        ]

    for (const table of tablesToClean) {
      await client.query(`TRUNCATE TABLE ${table} CASCADE`)
    }

    // Re-enable foreign key checks
    await client.query('SET session_replication_role = DEFAULT')
  } finally {
    client.release()
  }
}

/**
 * Wait for a specified time
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Create authenticated request headers
 * @param {string} token - JWT token
 * @returns {Object} Headers object
 */
export const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
})

/**
 * Make authenticated request
 * @param {Function} request - Supertest request function
 * @param {string} token - JWT token
 * @returns {Function} Request function with auth headers
 */
export const authenticatedRequest = (request, token) => {
  return request.set('Authorization', `Bearer ${token}`)
}
