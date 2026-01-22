// Setup script to initialize database (optional - schema is auto-created on first run)
import { initDatabase } from './database.js'
import logger from './utils/logger.js'

async function setup() {
  try {
    logger.info('Initializing database schema...')
    await initDatabase()
    
    logger.info('Database initialized successfully!')
    logger.info('You can now start the server with: npm run dev')
    logger.info('To create a user account, use the signup endpoint or the frontend.')
  } catch (error) {
    logger.error('Setup error', { 
      error: error.message, 
      stack: error.stack 
    })
    logger.error('Make sure:')
    logger.error('1. PostgreSQL is installed and running')
    logger.error('2. DATABASE_URL is set correctly in .env file')
    logger.error('3. The database exists (CREATE DATABASE costra;)')
    process.exit(1)
  }
}

setup()
