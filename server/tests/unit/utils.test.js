/**
 * Unit tests for utility functions
 * Day 6: Testing Infrastructure
 */

import { generateTestToken, authHeaders, wait } from '../utils.js'

describe('Test Utilities', () => {
  describe('generateTestToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateTestToken({ userId: 1, email: 'test@example.com' })
      
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // JWT has 3 parts
    })

    it('should use default values if payload not provided', () => {
      const token = generateTestToken()
      
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
    })
  })

  describe('authHeaders', () => {
    it('should create authorization headers', () => {
      const token = 'test-token'
      const headers = authHeaders(token)
      
      expect(headers).toHaveProperty('Authorization')
      expect(headers.Authorization).toBe(`Bearer ${token}`)
      expect(headers['Content-Type']).toBe('application/json')
    })
  })

  describe('wait', () => {
    it('should wait for specified time', async () => {
      const start = Date.now()
      await wait(100)
      const duration = Date.now() - start
      
      expect(duration).toBeGreaterThanOrEqual(90) // Allow some margin
      expect(duration).toBeLessThan(200)
    })
  })
})
