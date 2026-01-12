// Setup script to initialize database (optional - schema is auto-created on first run)
import { initDatabase } from './database.js'

async function setup() {
  try {
    console.log('Initializing database schema...')
    await initDatabase()
    
    console.log('Database initialized successfully!')
    console.log('\nYou can now start the server with: npm run dev')
    console.log('\nTo create a user account, use the signup endpoint or the frontend.')
  } catch (error) {
    console.error('Setup error:', error)
    console.error('\nMake sure:')
    console.error('1. PostgreSQL is installed and running')
    console.error('2. DATABASE_URL is set correctly in .env file')
    console.error('3. The database exists (CREATE DATABASE costra;)')
    process.exit(1)
  }
}

setup()
