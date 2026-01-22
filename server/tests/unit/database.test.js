/**
 * Unit tests for database functions
 * Day 6: Testing Infrastructure
 */

import {
  createUser,
  getUserByEmail,
  getUserById,
  updateUser,
  deleteUser,
  createUserPreferences,
  getUserPreferences,
  updateUserCurrency,
} from '../../database.js'
import { createTestUser, deleteTestUser, cleanupDatabase } from '../utils.js'

describe('Database Functions - Users', () => {
  beforeEach(async () => {
    await cleanupDatabase(['users', 'user_preferences'])
  })

  afterAll(async () => {
    await cleanupDatabase(['users', 'user_preferences'])
  })

  describe('createUser', () => {
    it('should create a new user', async () => {
      const user = await createUser('Test User', 'test@example.com', 'hashedPassword')
      
      expect(user).toBeDefined()
      expect(user.id).toBeDefined()
      expect(user.email).toBe('test@example.com')
      expect(user.name).toBe('Test User')
    })

    it('should throw error for duplicate email', async () => {
      await createUser('Test User', 'duplicate@example.com', 'hashedPassword')
      
      await expect(
        createUser('Another User', 'duplicate@example.com', 'hashedPassword')
      ).rejects.toThrow()
    })
  })

  describe('getUserByEmail', () => {
    it('should retrieve user by email', async () => {
      const created = await createUser('Test User', 'get@example.com', 'hashedPassword')
      const user = await getUserByEmail('get@example.com')
      
      expect(user).toBeDefined()
      expect(user.id).toBe(created.id)
      expect(user.email).toBe('get@example.com')
    })

    it('should return null for non-existent user', async () => {
      const user = await getUserByEmail('nonexistent@example.com')
      expect(user).toBeNull()
    })

    it('should be case-insensitive', async () => {
      await createUser('Test User', 'case@example.com', 'hashedPassword')
      const user = await getUserByEmail('CASE@EXAMPLE.COM')
      
      expect(user).toBeDefined()
      expect(user.email.toLowerCase()).toBe('case@example.com')
    })
  })

  describe('getUserById', () => {
    it('should retrieve user by ID', async () => {
      const created = await createUser('Test User', 'id@example.com', 'hashedPassword')
      const user = await getUserById(created.id)
      
      expect(user).toBeDefined()
      expect(user.id).toBe(created.id)
    })

    it('should return null for non-existent user', async () => {
      const user = await getUserById(99999)
      expect(user).toBeNull()
    })
  })

  describe('updateUser', () => {
    it('should update user information', async () => {
      const created = await createUser('Old Name', 'update@example.com', 'hashedPassword')
      const updated = await updateUser(created.id, { name: 'New Name' })
      
      expect(updated.name).toBe('New Name')
      expect(updated.email).toBe('update@example.com')
    })
  })

  describe('deleteUser', () => {
    it('should delete a user', async () => {
      const created = await createUser('Test User', 'delete@example.com', 'hashedPassword')
      await deleteUser(created.id)
      
      const user = await getUserById(created.id)
      expect(user).toBeNull()
    })
  })
})

describe('Database Functions - User Preferences', () => {
  let testUser

  beforeEach(async () => {
    await cleanupDatabase(['users', 'user_preferences'])
    testUser = await createTestUser()
  })

  afterAll(async () => {
    await cleanupDatabase(['users', 'user_preferences'])
  })

  describe('createUserPreferences', () => {
    it('should create user preferences', async () => {
      const prefs = await createUserPreferences(testUser.id, 'EUR')
      
      expect(prefs).toBeDefined()
      expect(prefs.user_id).toBe(testUser.id)
      expect(prefs.currency).toBe('EUR')
    })
  })

  describe('getUserPreferences', () => {
    it('should retrieve user preferences', async () => {
      await createUserPreferences(testUser.id, 'GBP')
      const prefs = await getUserPreferences(testUser.id)
      
      expect(prefs).toBeDefined()
      expect(prefs.currency).toBe('GBP')
    })

    it('should return null if preferences do not exist', async () => {
      const prefs = await getUserPreferences(99999)
      expect(prefs).toBeNull()
    })
  })

  describe('updateUserCurrency', () => {
    it('should update user currency', async () => {
      await createUserPreferences(testUser.id, 'USD')
      await updateUserCurrency(testUser.id, 'JPY')
      
      const prefs = await getUserPreferences(testUser.id)
      expect(prefs.currency).toBe('JPY')
    })
  })
})
