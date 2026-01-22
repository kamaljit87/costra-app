/**
 * Integration tests for cost data endpoints
 * Day 6: Testing Infrastructure
 */

import request from 'supertest'
import app from '../../server.js'
import { createTestUser, deleteTestUser, cleanupDatabase, generateTestToken } from '../utils.js'

describe('Cost Data API', () => {
  let testUser
  let authToken

  beforeEach(async () => {
    await cleanupDatabase(['users', 'cost_data', 'service_costs', 'user_preferences'])
    testUser = await createTestUser({
      email: 'costdata@example.com',
      password: 'TestPassword123!',
    })

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'costdata@example.com',
        password: 'TestPassword123!',
      })

    authToken = loginResponse.body.token
  })

  afterEach(async () => {
    if (testUser) {
      await deleteTestUser(testUser.id)
    }
    await cleanupDatabase(['users', 'cost_data', 'service_costs', 'user_preferences'])
  })

  describe('GET /api/cost-data', () => {
    it('should return cost data for authenticated user', async () => {
      const response = await request(app)
        .get('/api/cost-data')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('costData')
      expect(Array.isArray(response.body.costData)).toBe(true)
    })

    it('should reject unauthenticated requests', async () => {
      await request(app)
        .get('/api/cost-data')
        .expect(401)
    })
  })

  describe('GET /api/cost-data/preferences', () => {
    it('should return user preferences', async () => {
      const response = await request(app)
        .get('/api/cost-data/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('preferences')
      expect(response.body.preferences).toHaveProperty('currency')
    })

    it('should return default preferences if none exist', async () => {
      const response = await request(app)
        .get('/api/cost-data/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.preferences.currency).toBe('USD')
    })
  })

  describe('PUT /api/cost-data/preferences/currency', () => {
    it('should update user currency preference', async () => {
      const response = await request(app)
        .put('/api/cost-data/preferences/currency')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ currency: 'EUR' })
        .expect(200)

      expect(response.body).toHaveProperty('preferences')
      expect(response.body.preferences.currency).toBe('EUR')
    })

    it('should reject invalid currency', async () => {
      await request(app)
        .put('/api/cost-data/preferences/currency')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ currency: 'INVALID' })
        .expect(400)
    })

    it('should require currency parameter', async () => {
      await request(app)
        .put('/api/cost-data/preferences/currency')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400)
    })
  })
})
