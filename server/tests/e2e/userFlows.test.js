/**
 * End-to-end tests for complete user flows
 * Day 9: Final Testing & Production Readiness
 */

import request from 'supertest'
import app from '../../server.js'
import { createTestUser, deleteTestUser, cleanupDatabase, generateTestToken } from '../utils.js'

describe('E2E: Complete User Flows', () => {
  let testUser
  let authToken

  beforeEach(async () => {
    await cleanupDatabase()
    testUser = await createTestUser({
      email: 'e2e@example.com',
      password: 'TestPassword123!',
    })
  })

  afterEach(async () => {
    if (testUser) {
      await deleteTestUser(testUser.id)
    }
    await cleanupDatabase()
  })

  describe('User Registration and Login Flow', () => {
    it('should complete signup → login → get profile flow', async () => {
      // Step 1: Signup
      const signupResponse = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'E2E Test User',
          email: 'signup-flow@example.com',
          password: 'TestPassword123!',
        })
        .expect(201)

      expect(signupResponse.body).toHaveProperty('token')
      expect(signupResponse.body).toHaveProperty('user')
      const signupToken = signupResponse.body.token

      // Step 2: Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'signup-flow@example.com',
          password: 'TestPassword123!',
        })
        .expect(200)

      expect(loginResponse.body).toHaveProperty('token')
      const loginToken = loginResponse.body.token

      // Step 3: Get profile
      const profileResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${loginToken}`)
        .expect(200)

      expect(profileResponse.body.user.email).toBe('signup-flow@example.com')
    })
  })

  describe('Cost Data Flow', () => {
    beforeEach(async () => {
      // Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'e2e@example.com',
          password: 'TestPassword123!',
        })

      authToken = loginResponse.body.token
    })

    it('should get cost data for authenticated user', async () => {
      const response = await request(app)
        .get('/api/cost-data')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('costData')
      expect(Array.isArray(response.body.costData)).toBe(true)
    })

    it('should get and update user preferences', async () => {
      // Get preferences
      const getResponse = await request(app)
        .get('/api/cost-data/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(getResponse.body).toHaveProperty('preferences')

      // Update currency
      const updateResponse = await request(app)
        .put('/api/cost-data/preferences/currency')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ currency: 'EUR' })
        .expect(200)

      expect(updateResponse.body.preferences.currency).toBe('EUR')
    })
  })

  describe('Pagination Flow', () => {
    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'e2e@example.com',
          password: 'TestPassword123!',
        })

      authToken = loginResponse.body.token
    })

    it('should handle paginated notifications', async () => {
      const response = await request(app)
        .get('/api/notifications?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('data')
      expect(response.body).toHaveProperty('pagination')
      expect(response.body.pagination).toHaveProperty('page', 1)
      expect(response.body.pagination).toHaveProperty('limit', 10)
    })

    it('should handle paginated reports', async () => {
      const response = await request(app)
        .get('/api/reports?page=1&limit=20')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('data')
      expect(response.body).toHaveProperty('pagination')
    })
  })

  describe('Error Handling Flow', () => {
    it('should handle invalid credentials gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'WrongPassword123!',
        })
        .expect(401)

      expect(response.body).toHaveProperty('error')
    })

    it('should handle missing authentication token', async () => {
      const response = await request(app)
        .get('/api/cost-data')
        .expect(401)

      expect(response.body).toHaveProperty('error')
    })

    it('should handle invalid token', async () => {
      const response = await request(app)
        .get('/api/cost-data')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)

      expect(response.body).toHaveProperty('error')
    })
  })

  describe('Health Check Flow', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200)

      expect(response.body).toHaveProperty('status')
      expect(response.body).toHaveProperty('checks')
      expect(response.body.checks).toHaveProperty('database')
    })

    it('should return liveness status', async () => {
      const response = await request(app)
        .get('/api/health/liveness')
        .expect(200)

      expect(response.body.status).toBe('alive')
    })

    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/api/health/readiness')
        .expect(200)

      expect(response.body.status).toBe('ready')
    })
  })
})
