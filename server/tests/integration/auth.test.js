/**
 * Integration tests for authentication endpoints
 * Day 6: Testing Infrastructure
 */

import request from 'supertest'
import app from '../../server.js'
import { createTestUser, deleteTestUser, cleanupDatabase } from '../utils.js'

describe('Authentication API', () => {
  let testUser

  beforeEach(async () => {
    await cleanupDatabase(['users', 'user_preferences'])
  })

  afterEach(async () => {
    if (testUser) {
      await deleteTestUser(testUser.id)
    }
    await cleanupDatabase(['users', 'user_preferences'])
  })

  describe('POST /api/auth/signup', () => {
    it('should create a new user account', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test User',
          email: 'signup@example.com',
          password: 'TestPassword123!',
        })
        .expect(201)

      expect(response.body).toHaveProperty('token')
      expect(response.body).toHaveProperty('user')
      expect(response.body.user.email).toBe('signup@example.com')
    })

    it('should reject duplicate email', async () => {
      testUser = await createTestUser({ email: 'duplicate@example.com' })

      await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Another User',
          email: 'duplicate@example.com',
          password: 'TestPassword123!',
        })
        .expect(400)
    })

    it('should validate required fields', async () => {
      await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test User',
          // Missing email and password
        })
        .expect(400)
    })

    it('should validate email format', async () => {
      await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test User',
          email: 'invalid-email',
          password: 'TestPassword123!',
        })
        .expect(400)
    })
  })

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      testUser = await createTestUser({
        email: 'login@example.com',
        password: 'TestPassword123!',
      })
    })

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'TestPassword123!',
        })
        .expect(200)

      expect(response.body).toHaveProperty('token')
      expect(response.body).toHaveProperty('user')
      expect(response.body.user.email).toBe('login@example.com')
    })

    it('should reject invalid password', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'WrongPassword123!',
        })
        .expect(401)
    })

    it('should reject non-existent user', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123!',
        })
        .expect(401)
    })

    it('should be case-insensitive for email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'LOGIN@EXAMPLE.COM',
          password: 'TestPassword123!',
        })
        .expect(200)

      expect(response.body).toHaveProperty('token')
    })
  })

  describe('GET /api/auth/me', () => {
    let authToken

    beforeEach(async () => {
      testUser = await createTestUser({
        email: 'me@example.com',
        password: 'TestPassword123!',
      })

      // Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'me@example.com',
          password: 'TestPassword123!',
        })

      authToken = loginResponse.body.token
    })

    it('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('user')
      expect(response.body.user.email).toBe('me@example.com')
    })

    it('should reject request without token', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401)
    })

    it('should reject request with invalid token', async () => {
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)
    })
  })
})
